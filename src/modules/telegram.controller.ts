import { HumanMessage, AIMessage } from "@langchain/core/messages";
import TelegramTimetableagent from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";
import { redisclient } from "../lib/redis.ts";
import { TelegramDatabaseService } from "./telegram.service.ts";

const inMemoryLocks = new Map<string, number>();
const AGENT_TIMEOUT = 60_000;

class Telegramcontroller extends Telegramcommand {

    public static telegram = async (
        req: Request,
        res: Response
    ): Promise<Response | void> => {
        const currentMessage = req.body?.message || req.body?.channel_post || {};
        const chatid = currentMessage?.chat?.id;
        const text: string | undefined = currentMessage?.text;

        if (!chatid || !text) {
            return res.status(200).send("OK");
        }
        const cachekey = `telegram:cache:${chatid}`;

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
            if (sectionCmds.some(cmd => cmd && text.includes(cmd))) {

                const matchedCommands = sectionCmds.filter(cmd =>
                    cmd && text.includes(cmd)
                );

                if (matchedCommands.length > 1) {
                    await bot.sendMessage(chatid, "Please request only one section timetable at a time.");
                    return res.status(200).send("OK");
                }

                //Rate limit: Redis first, in-memory fallback
                let acquiredLock = false;
                try {
                    acquiredLock = !!(await redisclient.set(cachekey, "true", { NX: true, EX: 15 }));
                } catch {
                    const now = Date.now();
                    const lastReq = inMemoryLocks.get(cachekey) || 0;
                    if (now - lastReq < 15000) {
                        const remaining = Math.ceil((15000 - (now - lastReq)) / 1000);
                        await bot.sendMessage(chatid, `Do Not Spam! Please wait ${remaining}s Before Sending Again.`);
                        return res.status(200).send("OK");
                    }
                    inMemoryLocks.set(cachekey, now);
                    acquiredLock = true;
                }

                if (!acquiredLock) {
                    let displayTime = 15;
                    try { displayTime = Math.max(0, await redisclient.ttl(cachekey)); } catch { /* skip */ }
                    await bot.sendMessage(chatid, `Do Not Spam! Please wait ${displayTime}s Before Sending Again.`);
                    return res.status(200).send("OK");
                }

                //Respond 200 immediately — Telegram won't retry
                res.status(200).send("OK");

                //Background processing
                const waitMessage = await bot.sendMessage(chatid, "🤖 Please wait while agent is finding the work for you. 🤖");

                //Save user message + fetch last 10 messages for context (non-blocking — DB may be unreachable)
                const chatIdBigInt = BigInt(chatid);
                TelegramDatabaseService.saveText(chatIdBigInt, text, "user").catch(() => {});
                const history = await Promise.race([
                    TelegramDatabaseService.getChatHistory(chatIdBigInt, 10),
                    new Promise<[]>(resolve => setTimeout(resolve, 3000, []))
                ]).catch(() => []);
                const historyMessages = history.reverse().map(h =>
                    h.role === "assistant" ? new AIMessage(h.message) : new HumanMessage(h.message)
                );

                const agentPromise = TelegramTimetableagent.invoke({
                    messages: [...historyMessages, new HumanMessage(text)]
                }, { recursionLimit: 10 });

                const timeoutPromise = new Promise<null>((_, reject) =>
                    setTimeout(() => reject(new Error("Agent timeout")), AGENT_TIMEOUT)
                );

                let finalAnswer: string | null = null;

                const runStatusUpdates = async () => {
                    const updates = [
                        "⏳ Starting the work search...",
                        "🔍 Analyzing Section Timetable...",
                        "📂 Sorting through data...",
                        "🚀 Almost ready!"
                    ];
                    for (const updateText of updates) {
                        if (finalAnswer) break;
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        if (finalAnswer) break;
                        try {
                            await bot.editMessageText(updateText, {
                                chat_id: chatid,
                                message_id: waitMessage.message_id
                            });
                        } catch { /* message may have been deleted */ }
                    }
                };

                const updatesPromise = runStatusUpdates();

                try {
                    const result = await Promise.race([agentPromise, timeoutPromise]);
                    if (result) {
                        finalAnswer = result.messages[result.messages.length - 1].content as string;
                    }
                } finally {
                    finalAnswer = finalAnswer || "Failed to retrieve timetable data.";
                }

                await updatesPromise;

                try {
                    await redisclient.del(cachekey);
                } catch { /* skip */ }

                //Save assistant reply (non-blocking)
                TelegramDatabaseService.saveText(chatIdBigInt, finalAnswer, "assistant").catch(() => {});

                const maxLen = 4000;
                if (finalAnswer.length > maxLen) {
                    try {
                        await bot.editMessageText(finalAnswer.slice(0, maxLen), {
                            chat_id: chatid,
                            message_id: waitMessage.message_id
                        });
                    } catch { /* skip */ }
                    for (let i = maxLen; i < finalAnswer.length; i += maxLen) {
                        try { await bot.sendMessage(chatid, finalAnswer.slice(i, i + maxLen)); } catch { /* skip */ }
                    }
                } else {
                    try {
                        await bot.editMessageText(finalAnswer, {
                            chat_id: chatid,
                            message_id: waitMessage.message_id
                        });
                    } catch { /* skip */ }
                }

                return;
            }

            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            console.error("Agent execution error:", err);
            if (chatid) {
                try { await redisclient.del(cachekey); } catch { /* skip */ }
                try { await bot.sendMessage(chatid, "It seems something went wrong."); } catch { /* skip */ }
            }
            return res.status(200).send("OK");
        }
    };
}

export { Telegramcontroller };
