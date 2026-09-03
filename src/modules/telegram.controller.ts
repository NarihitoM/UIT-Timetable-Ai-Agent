import { HumanMessage } from "@langchain/core/messages";
import TelegramTimetableagent, { extractFinalAnswer } from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";
import { redisclient } from "../lib/redis.ts";
import { RATE_LIMIT_SECONDS, TYPING_REFRESH_MS } from "../constants.ts";
import { loadHistory, saveTurn } from "../lib/memory.ts";
import { toTelegramMarkdown } from "../lib/format.ts";

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

    private static sentKey = (chatid: number, messageid: number) => `telegram:sent:${chatid}:${messageid}`;

    // In a channel the bot's own posts arrive back as channel_post with no `from` field, so
    // they cannot be told apart from a human admin's. Remembering what we sent can.
    private static remember = async (chatid: number, messageid?: number): Promise<void> => {
        if (messageid === undefined) return;

        const key = Telegramcontroller.sentKey(chatid, messageid);
        try {
            await redisclient.set(key, "1", { EX: 300 });
        } catch {
            inMemoryLocks.set(key, Date.now());
        }
    };

    private static isOwnMessage = async (chatid: number, messageid?: number): Promise<boolean> => {
        if (messageid === undefined) return false;

        const key = Telegramcontroller.sentKey(chatid, messageid);
        try {
            return !!(await redisclient.get(key));
        } catch {
            return inMemoryLocks.has(key);
        }
    };

    // Every outgoing message goes through here, so nothing can be sent without being remembered
    private static reply = async (
        chatid: number,
        text: string,
        options?: Record<string, unknown>
    ): Promise<void> => {
        const sent = options
            ? await bot.sendMessage(chatid, text, options)
            : await bot.sendMessage(chatid, text);
        await Telegramcontroller.remember(chatid, sent?.message_id);
    };

    private static startTyping = (chatid: number): (() => void) => {
        //Purely cosmetic, so it must never throw into the request and leak the rate-limit lock
        const send = async () => {
            try {
                await bot.sendChatAction(chatid, "typing");
            } catch { /* skip */ }
        };

        void send();
        const timer = setInterval(send, TYPING_REFRESH_MS);
        return () => clearInterval(timer);
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
            //The text guard above is a heuristic. This one is exact: we know what we sent.
            if (await Telegramcontroller.isOwnMessage(chatid, currentMessage?.message_id)) {
                return res.status(200).send("OK");
            }

            //Telegram redelivers the same update when the webhook is slow, ignore the repeats
            if (updateid !== undefined && !(await Telegramcontroller.isFirstDelivery(`telegram:update:${updateid}`))) {
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[0] && text.includes(Telegramcontroller.commands[0])) {
                await Telegramcontroller.reply(chatid, "You can now get started. Developed by Narihito(Hein Htet Aung) and Velluz(Hein Thu Aung) From Section C and D.\n\n\nImportant Notice: Ai can make mistakes. Use With Cautions.\n\nHappy Asking ^_^.");
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[1] && text.includes(Telegramcontroller.commands[1])) {
                // Keep this list in sync with SECTIONS in src/constants.ts
                await Telegramcontroller.reply(chatid, "You can use these commands for each timetable:\n\nSemester 2:\n- /sem2_a, /sem2_b, /sem2_c, /sem2_d, /sem2_e\n\nSemester 4:\n- /sem4_a, /sem4_b, /sem4_c, /sem4_d\n\nSemester 6:\n- /sem6_ct, /sem6_a_cs, /sem6_b_cs, /sem6_c_cs, /sem6_d_cs\n\nSemester 8:\n- /sem8_se, /sem8_ke, /sem8_hpc, /sem8_es, /sem8_ccn, /sem8_bis\n\n- /room to find available rooms. \n\nAlso if you want to add to groups or channels, don't forget to give the bot admin permissions.");
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[2] && text.includes(Telegramcontroller.commands[2])) {
                await Telegramcontroller.reply(chatid, "Contributors: \nHein Htet Aung & Hein Thu Aung\n");
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[3] && text.includes(Telegramcontroller.commands[3])) {
                await Telegramcontroller.reply(chatid, "Source Code: https://github.com/NarihitoM/UIT-Timetable-Ai-Agent");
                return res.status(200).send("OK");
            }

            //Agent Message route
            const sectionCmds = Telegramcontroller.commands.slice(4);
            if (sectionCmds.some(cmd => cmd && text.includes(cmd))) {

                const matchedCommands = sectionCmds.filter(cmd =>
                    cmd && text.includes(cmd)
                );

                if (matchedCommands.length > 1) {
                    await Telegramcontroller.reply(chatid, "Please request only one section timetable at a time.");
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
                        await Telegramcontroller.reply(chatid, `Do Not Spam! Please wait ${remaining}s Before Sending Again.`);
                        return res.status(200).send("OK");
                    }
                    inMemoryLocks.set(cachekey, now);
                    acquiredLock = true;
                }

                if (!acquiredLock) {
                    let displayTime = RATE_LIMIT_SECONDS;
                    try { displayTime = Math.max(0, await redisclient.ttl(cachekey)); } catch { /* skip */ }
                    await Telegramcontroller.reply(chatid, `Do Not Spam! Please wait ${displayTime}s Before Sending Again.`);
                    return res.status(200).send("OK");
                }


                //Telegram clears the typing indicator after ~5s, so keep refreshing it while the agent works
                const keepTyping = Telegramcontroller.startTyping(chatid);

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

                    try {
                        await Telegramcontroller.reply(chatid, toTelegramMarkdown(finalAnswer), {
                            parse_mode: "MarkdownV2"
                        });
                    } catch (e) {
                        //Telegram rejects the whole message on one bad entity, so deliver it unformatted
                        console.error("Formatted send failed, falling back to plain text:", e);
                        await Telegramcontroller.reply(chatid, finalAnswer);
                    }
                } finally {
                    // The key is never deleted on purpose. Letting it expire turns it from an
                    // in-flight guard into a real cooldown, and it covers the whole request either way.
                    keepTyping();
                }

                return res.status(200).send("OK");
            }

            await Telegramcontroller.reply(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            console.error("Agent execution error:", err);
            if (chatid) {
                try { await Telegramcontroller.reply(chatid, "It seems something went wrong."); } catch { /* skip */ }
            }
            return res.status(200).send("OK");
        }
    };
}

export { Telegramcontroller };
