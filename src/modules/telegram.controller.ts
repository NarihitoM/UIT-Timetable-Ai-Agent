import { HumanMessage } from "@langchain/core/messages";
import TelegramTimetableagent, { extractFinalAnswer } from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";
import { redisclient } from "../lib/redis.ts";
import { RATE_LIMIT_SECONDS } from "../constants.ts";
import { loadHistory, saveTurn } from "../lib/memory.ts";

const inMemoryLocks = new Map<string, number>();

class Telegramcontroller extends Telegramcommand {

    private static isFirstDelivery = async (key: string): Promise<boolean> => {
        try {
            return !!(await redisclient.set(key, "1", { NX: true, EX: 300 }));
        } catch {
            const now = Date.now();
            if (inMemoryLocks.has(key)) {
                return false;
            }
            for (const [k, t] of inMemoryLocks) {
                if (now - t > 300000) {
                    inMemoryLocks.delete(k);
                }
            }
            inMemoryLocks.set(key, now);
            return true;
        }
    };

    public static telegram = async (
        req: Request,
        res: Response
    ): Promise<Response | void> => {
        const currentMessage = req.body?.message || req.body?.channel_post || {};
        const chatid = currentMessage?.chat?.id;
        const text: string | undefined = currentMessage?.text;
        const updateid = req.body?.update_id;

        if (!chatid || !text) {
            return res.status(200).send("OK");
        }

        //Posts the bot makes in a channel come straight back as channel_post, never answer those
        if (currentMessage?.from?.is_bot || !text.trim().startsWith("/")) {
            return res.status(200).send("OK");
        }
        const cachekey = `telegram:cache:${chatid}`;

        try {
            //Telegram redelivers the same update when the webhook is slow, ignore the repeats
            if (updateid !== undefined && !(await Telegramcontroller.isFirstDelivery(`telegram:update:${updateid}`))) {
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[0] && text.includes(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can now get started. Developed by Narihito(Hein Htet Aung) From Section C.\n\n\nImportant Notice: Ai can make mistakes. Use With Cautions.\n\nHappy Asking ^_^.");
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[1] && text.includes(Telegramcontroller.commands[1])) {
                // Keep this list in sync with SECTIONS in src/constants.ts
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
                    acquiredLock = !!(await redisclient.set(cachekey, "true", { NX: true, EX: RATE_LIMIT_SECONDS }));
                } catch {
                    const now = Date.now();
                    const lastReq = inMemoryLocks.get(cachekey) || 0;
                    const windowMs = RATE_LIMIT_SECONDS * 1000;
                    if (now - lastReq < windowMs) {
                        const remaining = Math.ceil((windowMs - (now - lastReq)) / 1000);
                        await bot.sendMessage(chatid, `Do Not Spam! Please wait ${remaining}s Before Sending Again.`);
                        return res.status(200).send("OK");
                    }
                    inMemoryLocks.set(cachekey, now);
                    acquiredLock = true;
                }

                if (!acquiredLock) {
                    let displayTime = RATE_LIMIT_SECONDS;
                    try { displayTime = Math.max(0, await redisclient.ttl(cachekey)); } catch { /* skip */ }
                    await bot.sendMessage(chatid, `Do Not Spam! Please wait ${displayTime}s Before Sending Again.`);
                    return res.status(200).send("OK");
                }


                //Background processing
                const waitMessage = await bot.sendMessage(chatid, "Please wait while agent is finding the work for you. 🤖");

                try {
                    let finalAnswer: string | undefined;

                    try {
                        const history = await loadHistory(chatid);
                        const result = await TelegramTimetableagent.invoke({
                            messages: [...history, new HumanMessage(text)]
                        });
                        finalAnswer = extractFinalAnswer(result);
                    } catch (e) {
                        console.error("Agent error:", e);
                    } finally {
                        finalAnswer = finalAnswer || "Failed to retrieve timetable data.";
                    }

                    await saveTurn(chatid, text, finalAnswer);

                    await bot.editMessageText(finalAnswer, {
                        chat_id: chatid,
                        message_id: waitMessage.message_id
                    });
                } finally {
                    // Hold the lock for the whole request (including delivery), not just the LLM call,
                    // so a slow editMessageText can't leave a window for an overlapping request.
                    try { await redisclient.del(cachekey); } catch { /* skip */ }
                }

                return res.status(200).send("OK");
            }

            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            console.error("Agent execution error:", err);
            if (chatid) {
                try { await bot.sendMessage(chatid, "It seems something went wrong."); } catch { /* skip */ }
            }
            return res.status(200).send("OK");
        }
    };
}

export { Telegramcontroller };
