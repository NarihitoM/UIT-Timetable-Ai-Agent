import { HumanMessage, AIMessage } from "@langchain/core/messages";
import TelegramTimetableagent from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";
import { redisclient } from "../lib/redis.ts";
import { TelegramDatabaseService } from "./telegram.service.ts";

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

        const chatIdBig = BigInt(chatid);

        //Cache
        let cachekey = `telegram:cache:${chatid}`;

        try {
            if (Telegramcontroller.commands[0] && text.includes(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can now get started. Developed by Narihito(Hein Htet Aung) From Section C.\n\n\nImportant Notice: Ai can make mistakes. Use With Cautions.\n\nHappy Asking ^_^.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[1] && text.includes(Telegramcontroller.commands[1])) {
                await bot.sendMessage(chatid, "You can use these commands for each timetable:\n\nSemester 2:\n- /sem2_a, /sem2_b, /sem2_c, /sem2_d, /sem2_e\n\nSemester 4:\n- /sem4_a or /section_a, /sem4_b or /section_b, /sem4_c or /section_c, /sem4_d or /section_d\n\nSemester 6:\n- /sem6_ct, /sem6_a_cs, /sem6_b_cs, /sem6_c_cs, /sem6_d_cs\n\nSemester 8:\n- /sem8_se, /sem8_ke, /sem8_hpc, /sem8_es, /sem8_ccn, /sem8_bis\n\n- /room to find available rooms. (Pending due to insufficient data.)\n\nAlso if you want to add to groups or channels, don't forget to give the bot admin permissions.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[2] && text.includes(Telegramcontroller.commands[2])) {
                await bot.sendMessage(chatid, "Contributors: Team SE Group Members:\nHein Htet Aung\nHein Thu Aung\nAung Thanlwin Oo\nHtoo Myat Min Eain\nAung Htoo Pyae\nThaw Thaw Tun\nBhone Wint Kyaw.\n\n\n\nSpecial Thanks:\nOkkar Min Htin\nThant Zabu Htun\nfor suggestions and improvements.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[3] && text.includes(Telegramcontroller.commands[3])) {
                await bot.sendMessage(chatid, "Source Code: https://github.com/NarihitoM/UIT-Timetable-Ai-Agent");

                return res.status(200).send("OK");
            }


            //Agent Message route
            if (
                (Telegramcontroller.commands[4] && text.includes(Telegramcontroller.commands[4])) ||
                (Telegramcontroller.commands[5] && text.includes(Telegramcontroller.commands[5])) ||
                (Telegramcontroller.commands[6] && text.includes(Telegramcontroller.commands[6])) ||
                (Telegramcontroller.commands[7] && text.includes(Telegramcontroller.commands[7])) ||
                (Telegramcontroller.commands[8] && text.includes(Telegramcontroller.commands[8])) ||
                (Telegramcontroller.commands[9] && text.includes(Telegramcontroller.commands[9])) ||
                (Telegramcontroller.commands[10] && text.includes(Telegramcontroller.commands[10])) ||
                (Telegramcontroller.commands[11] && text.includes(Telegramcontroller.commands[11])) ||
                (Telegramcontroller.commands[12] && text.includes(Telegramcontroller.commands[12])) ||
                (Telegramcontroller.commands[13] && text.includes(Telegramcontroller.commands[13])) ||
                (Telegramcontroller.commands[14] && text.includes(Telegramcontroller.commands[14])) ||
                (Telegramcontroller.commands[15] && text.includes(Telegramcontroller.commands[15])) ||
                (Telegramcontroller.commands[16] && text.includes(Telegramcontroller.commands[16])) ||
                (Telegramcontroller.commands[17] && text.includes(Telegramcontroller.commands[17])) ||
                (Telegramcontroller.commands[18] && text.includes(Telegramcontroller.commands[18])) ||
                (Telegramcontroller.commands[19] && text.includes(Telegramcontroller.commands[19])) ||
                (Telegramcontroller.commands[20] && text.includes(Telegramcontroller.commands[20])) ||
                (Telegramcontroller.commands[21] && text.includes(Telegramcontroller.commands[21])) ||
                (Telegramcontroller.commands[22] && text.includes(Telegramcontroller.commands[22])) ||
                (Telegramcontroller.commands[23] && text.includes(Telegramcontroller.commands[23])) ||
                (Telegramcontroller.commands[24] && text.includes(Telegramcontroller.commands[24]))
            ) {

                const matchedCommands = Telegramcontroller.commands.slice(4).filter(cmd =>
                    cmd && text.includes(cmd)
                );

                if (matchedCommands.length > 1) {
                    await bot.sendMessage(chatid, "Please request only one section timetable at a time.");
                    return res.status(200).send("OK");
                }

                const acquiredLock = await redisclient.set(cachekey, "true", {
                    NX: true,
                    EX: 15
                });

                if (!acquiredLock) {
                    const timeleft = await redisclient.ttl(cachekey);
                    const displayTime = timeleft > 0 ? timeleft : 0;
                    await bot.sendMessage(chatid, `Do Not Spam! Please wait ${displayTime}s Before Sending Again.`);
                    return res.status(200).send("OK");
                }

                //Save message
                /* await TelegramDatabaseService.saveText(chatIdBig, text); */

                const waitMessage = await bot.sendMessage(chatid, "🤖 Please wait while agent is finding the work for you. 🤖");

                const updates = [
                    "⏳ Starting the work search...",
                    "🔍 Analyzing Section Timetable...",
                    "📂 Sorting through data...",
                    "🚀 Almost ready!"
                ];


                //Fetch History
                /* const history = await TelegramDatabaseService.getChatHistory(chatIdBig, 5);
                const contextMessages = history.reverse().map(h =>
                    h.role === "assistant" ? new AIMessage(h.message) : new HumanMessage(h.message)
                ); */

                const agentPromise = TelegramTimetableagent.invoke({
                    messages: [new HumanMessage(text)]
                }, {
                    recursionLimit: 20
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

                //Save to db
                /* await TelegramDatabaseService.saveText(chatIdBig, finalAnswer, "assistant"); */

                await bot.editMessageText(finalAnswer, {
                    chat_id: chatid,
                    message_id: waitMessage.message_id
                });

                return res.status(200).send("OK");
            }

            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            //Error
            console.log(err);
            if (chatid) {
                try {
                    await redisclient.del(cachekey);
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