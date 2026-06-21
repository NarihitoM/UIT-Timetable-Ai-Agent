import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import TelegramTimetableagent from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";
import { redisclient } from "../lib/redis.ts";

const inMemoryLocks = new Map<string, number>();

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
            // ─── Static commands ──────────────────────────────────────────────
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

            // ─── Agent commands ───────────────────────────────────────────────
            const sectionCmds = Telegramcontroller.commands.slice(4);
            const isAgentCommand =
                sectionCmds.some(cmd => cmd && text.includes(cmd)) ||
                /\/room|available room|free room|empty room/i.test(text);

            if (isAgentCommand) {
                const matchedCommands = sectionCmds.filter(cmd => cmd && text.includes(cmd));

                if (matchedCommands.length > 1) {
                    await bot.sendMessage(chatid, "Please request only one section timetable at a time.");
                    return res.status(200).send("OK");
                }

                // ─── Rate limiting ────────────────────────────────────────────
                let acquiredLock = false;
                try {
                    acquiredLock = !!(await redisclient.set(cachekey, "true", { NX: true, EX: 15 }));
                } catch (redisErr) {
                    console.warn("Redis unavailable, falling back to in-memory lock:", redisErr);
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
                    try {
                        displayTime = Math.max(0, await redisclient.ttl(cachekey));
                    } catch {
                        // ignore, use default
                    }
                    await bot.sendMessage(chatid, `Do Not Spam! Please wait ${displayTime}s Before Sending Again.`);
                    return res.status(200).send("OK");
                }

                // ─── Fire-and-forget agent invocation ────────────────────────
                (async () => {
                    const waitMessage = await bot.sendMessage(chatid, "🤖 Please wait while agent is finding the work for you. 🤖");
                    let finalAnswer: string | null = null;

                    try {
                        const now = new Date();
                        const day = now.toLocaleDateString("en-GB", { timeZone: "Asia/Yangon", weekday: "long" });
                        const time = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Yangon", hour: "2-digit", minute: "2-digit" });

                        console.log(`[Agent] Invoking for chatid=${chatid}, text="${text}", time=${day} ${time}`);
                        console.log(`[Agent] Agent instance:`, TelegramTimetableagent);

                        const result = await TelegramTimetableagent.invoke(
                            {
                                messages: [
                                    new SystemMessage(`Current date and time: ${day}, ${time} MMT`),
                                    new HumanMessage(text)
                                ]
                            },
                            { recursionLimit: 25 }  // raised from 10 — low limits cause silent failures
                        );

                        console.log(`[Agent] Raw result:`, JSON.stringify(result, null, 2));

                        const msgs = result?.messages || [];
                        const last = msgs[msgs.length - 1];
                        finalAnswer = (last?.content as string) || null;

                        console.log(`[Agent] Final answer:`, finalAnswer);

                    } catch (agentErr) {
                        console.error("[Agent] Invocation error:", agentErr);
                        finalAnswer = null;
                    } finally {
                        if (!finalAnswer) {
                            finalAnswer = "It seems something went wrong. Please try again.";
                        }
                    }

                    // ─── Send the reply ───────────────────────────────────────
                    try {
                        const maxLen = 4000;
                        if (finalAnswer.length > maxLen) {
                            // Edit the "please wait" message with the first chunk
                            await bot.editMessageText(finalAnswer.slice(0, maxLen), {
                                chat_id: chatid,
                                message_id: waitMessage.message_id
                            });
                            // Send remaining chunks as new messages
                            for (let i = maxLen; i < finalAnswer.length; i += maxLen) {
                                await bot.sendMessage(chatid, finalAnswer.slice(i, i + maxLen));
                            }
                        } else {
                            await bot.editMessageText(finalAnswer, {
                                chat_id: chatid,
                                message_id: waitMessage.message_id
                            });
                        }
                    } catch (editErr) {
                        console.error("[Bot] editMessageText failed:", editErr);
                        // Fallback: send as a fresh message instead
                        try {
                            await bot.sendMessage(chatid, finalAnswer);
                        } catch (sendErr) {
                            console.error("[Bot] sendMessage fallback also failed:", sendErr);
                        }
                    }

                    // ─── Release the lock ─────────────────────────────────────
                    try {
                        await redisclient.del(cachekey);
                    } catch (delErr) {
                        console.warn("[Redis] Failed to release lock:", delErr);
                        // Clean up in-memory lock as a fallback
                        inMemoryLocks.delete(cachekey);
                    }
                })();

                return res.status(200).send("OK");
            }

            // ─── Unknown command ──────────────────────────────────────────────
            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            console.error("[Controller] Unhandled error:", err);
            if (chatid) {
                try { await redisclient.del(cachekey); } catch { }
                try { await bot.sendMessage(chatid, "It seems something went wrong."); } catch { }
            }
            return res.status(200).send("OK");
        }
    };
}

export { Telegramcontroller };