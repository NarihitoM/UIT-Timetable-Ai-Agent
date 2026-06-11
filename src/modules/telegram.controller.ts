import { HumanMessage } from "@langchain/core/messages";
import TelegramTimetableagent from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";
import { redisclient } from "../lib/redis.ts";

class Telegramcontroller extends Telegramcommand {

    public static telegram = async (
        req: Request,
        res: Response
    ): Promise<Response> => {
        //Input
        const currentMessage = req.body?.message || req.body?.channel_post || {};
        const chatid = currentMessage?.chat?.id;
        const text: string | undefined = currentMessage?.text;

        if (!chatid || !text) {
            return res.status(200).send("OK");
        }

        try {
            const cachekey = `telegram:cache:${chatid}`;

            if (Telegramcontroller.commands[0] && text.includes(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can now get started. Developed by Narihito(Hein Htet Aung) From Section C. Happy Asking ^_^.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[1] && text.includes(Telegramcontroller.commands[1])) {
                await bot.sendMessage(chatid, "You can use commands\n- /section_a,\n- /section_b,\n- /section_c,\n- /section_d for each timetable and ask.\nAlso If you wanna add to groups or channels, Don't forget to give bot permission admin.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[2] && text.includes(Telegramcontroller.commands[2])) {
                await bot.sendMessage(chatid, "Contributors: Team SE Group For Relevent Datas.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[3] && text.includes(Telegramcontroller.commands[3])) {
                await bot.sendMessage(chatid, "Source Code: https://github.com/NarihitoM/UIT-Timetable-Ai-Agent");

                return res.status(200).send("OK");
            }

            if (
                (Telegramcontroller.commands[4] && text.includes(Telegramcontroller.commands[4])) ||
                (Telegramcontroller.commands[5] && text.includes(Telegramcontroller.commands[5])) ||
                (Telegramcontroller.commands[6] && text.includes(Telegramcontroller.commands[6])) ||
                (Telegramcontroller.commands[7] && text.includes(Telegramcontroller.commands[7]))
            ) {

                const matchedCommands = Telegramcontroller.commands.slice(3, 7).filter(cmd =>
                    cmd && text.includes(cmd)
                );

                if (matchedCommands.length > 1) {
                    await bot.sendMessage(chatid, "Please request only one section timetable at a time.");

                    return res.status(200).send("OK");
                }

                const acquiredLock = await redisclient.set(cachekey, "true", {
                    NX: true,
                    EX: 90
                });

                if (!acquiredLock) {
                    const timeleft = await redisclient.ttl(cachekey);
                    const displayTime = timeleft > 0 ? timeleft : 0;
                    await bot.sendMessage(chatid, `Do Not Spam! Please wait ${displayTime}s Before Sending Again.`);
                    return res.status(200).send("OK");
                }


                const waitMessage = await bot.sendMessage(chatid, "🤖 Please wait while agent is finding the work for you. 🤖");

                const updates = [
                    "⏳ Starting the work search...",
                    "☕ Grab a cup of coffee...",
                    "🔍 Analyzing Section Timetable...",
                    "📂 Sorting through data...",
                    "🚀 Almost ready!"
                ];

                const agentPromise = TelegramTimetableagent.invoke({
                    messages: [new HumanMessage(text)]
                });

                let finalAnswer: string | null = null;

                const runStatusUpdates = async () => {
                    for (const updateText of updates) {
                        if (finalAnswer) break;

                        await new Promise(resolve => setTimeout(resolve, 2000));

                        if (finalAnswer) break;

                        await bot.editMessageText(updateText, {
                            chat_id: chatid,
                            message_id: waitMessage.message_id
                        });
                    }
                };

                const updatesPromise = runStatusUpdates();

                try {
                    const result = await agentPromise;
                    finalAnswer = result.messages[result.messages.length - 1].content as string;
                } finally {
                    finalAnswer = finalAnswer || "Failed to retrieve timetable data.";
                }

                await updatesPromise;

                await bot.editMessageText(finalAnswer, {
                    chat_id: chatid,
                    message_id: waitMessage.message_id
                });

                return res.status(200).send("OK");
            }

            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            console.log(err);

            if (chatid) {
                try {
                    await bot.sendMessage(chatid, "It seems something went wrong.");
                } catch (err) {
                    console.log(err);
                }
            }

            return res.status(200).send("OK");
        }
    };
}

export { Telegramcontroller };