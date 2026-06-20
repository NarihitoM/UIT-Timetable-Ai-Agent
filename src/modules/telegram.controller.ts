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
        //Cache
        let cachekey = `telegram:cache:${chatid}`;

        try {
            if (Telegramcontroller.commands[0] && text.includes(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can now get started. Developed by Narihito(Hein Htet Aung) From Section C.\n\n\nImportant Notice: Ai can make mistakes. Use With Cautions.\n\nHappy Asking ^_^.");

                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[1] && text.includes(Telegramcontroller.commands[1])) {
                await bot.sendMessage(chatid, "You can use these commands for each timetable:\n\nSemester 2:\n- /sem2_a, /sem2_b, /sem2_c, /sem2_d, /sem2_e\n\nSemester 4:\n- /sem4_a, /sem4_b, /sem4_c, /sem4_d\n\nSemester 6:\n- /sem6_ct, /sem6_a_cs, /sem6_b_cs, /sem6_c_cs, /sem6_d_cs\n\nSemester 8:\n- /sem8_se, /sem8_ke, /sem8_hpc, /sem8_es, /sem8_ccn, /sem8_bis\n\n- /room to find available rooms. \n\nAlso if you want to add to groups or channels, don't forget to give the bot admin permissions.");

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
            const sectionCmds = Telegramcontroller.commands.slice(4);
            const isAgentCommand = sectionCmds.some(cmd => cmd && text.includes(cmd)) || /\/room|available room|free room|empty room/i.test(text);

            if (isAgentCommand) {

                const matchedCommands = sectionCmds.filter(cmd =>
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


                const waitMessage = await bot.sendMessage(chatid, "🤖 Please wait while agent is finding the work for you. 🤖");

                const updates = [
                    "⏳ Starting the work search...",
                    "🔍 Analyzing Section Timetable...",
                    "📂 Sorting through data...",
                    "🚀 Almost ready!"
                ];

                let cancelled = false;

                const agentPromise = TelegramTimetableagent.invoke({
                    messages: [new HumanMessage(text)]
                });

                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Agent timeout after 60s")), 60000)
                );

                let finalAnswer: string | null = null;

                const runStatusUpdates = async () => {
                    for (const updateText of updates) {
                        if (cancelled) break;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        if (cancelled) break;
                        try {
                            await bot.editMessageText(updateText, {
                                chat_id: chatid,
                                message_id: waitMessage.message_id
                            });
                        } catch { /* message may already be edited */ }
                    }
                };

                const updatesPromise = runStatusUpdates();

                try {
                    const result = await Promise.race([agentPromise, timeoutPromise]);
                    finalAnswer = result.messages[result.messages.length - 1].content as string;
                } catch (err) {
                    console.error("Agent execution error:", err);
                    finalAnswer = "It seems something went wrong.";
                } finally {
                    cancelled = true;
                    finalAnswer = finalAnswer || "It seems something went wrong.";
                }

                await updatesPromise;

                try {
                    const maxLen = 4000;
                    if (finalAnswer.length > maxLen) {
                        await bot.editMessageText(finalAnswer.slice(0, maxLen), {
                            chat_id: chatid,
                            message_id: waitMessage.message_id
                        }).catch(() => bot.sendMessage(chatid, finalAnswer.slice(0, maxLen)));
                        for (let i = maxLen; i < finalAnswer.length; i += maxLen) {
                            await bot.sendMessage(chatid, finalAnswer.slice(i, i + maxLen));
                        }
                    } else {
                        await bot.editMessageText(finalAnswer, {
                            chat_id: chatid,
                            message_id: waitMessage.message_id
                        }).catch(() => bot.sendMessage(chatid, finalAnswer));
                    }
                } catch (err) {
                    console.error("Failed to send final answer:", err);
                    try { await bot.sendMessage(chatid, finalAnswer); } catch { /* give up */ }
                }

                await redisclient.del(cachekey);
                return res.status(200).send("OK");
            }

            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            //Error
            console.error("Agent execution error:", err);
            if (err instanceof Error) {
                console.error("Error name:", err.name);
                console.error("Error message:", err.message);
                console.error("Error stack:", err.stack);
            }
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