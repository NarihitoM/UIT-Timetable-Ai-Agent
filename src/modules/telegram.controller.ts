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
            const data = await redisclient.get(cachekey);

            if (data) {
                const timeleft = await redisclient.ttl(cachekey);
                await bot.sendMessage(chatid, `Please wait ${timeleft}s before sending again.`);
                return res.status(200).send("OK");
            }

            if (text.startsWith(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can now get started. Developer By Narihito From Section C. Happy Asking ^_^.");
                return res.status(200).send("OK");
            } 
            
            if (text.startsWith(Telegramcontroller.commands[1])) {
                await bot.sendMessage(chatid, "You can use commands /section_a, /section_b, /section_c, /section_d for each timetable.");
                return res.status(200).send("OK");
            } 
            
            const isSectionCommand = [2, 3, 4, 5].some(
                (index) => Telegramcontroller.commands[index] && text.startsWith(Telegramcontroller.commands[index])
            );

            if (isSectionCommand) {
                const waitMessage = await bot.sendMessage(chatid, "Please wait while agent is running.");

                const result = await TelegramTimetableagent.invoke(
                    { messages: [new HumanMessage(text)] }
                );

                const finalAnswer = result.messages[result.messages.length - 1].content as string;

                await bot.editMessageText(finalAnswer, {
                    chat_id: chatid,
                    message_id: waitMessage.message_id
                });

                await redisclient.set(cachekey, `Set User: ${chatid}`, {
                    EX: 60
                });

                return res.status(200).send("OK");
            } 
            
            await bot.sendMessage(chatid, "There is no command with that function.");
            return res.status(200).send("OK");

        } catch (err: unknown) {
            console.error("Telegram Controller Error:", err);

            if (chatid) {
                try {
                    await bot.sendMessage(chatid, "It seems something went wrong.");
                } catch (telegramErr) {
                    console.error("Failed to send error message to Telegram:", telegramErr);
                }
            }

            return res.status(200).send("OK");
        }
    };
}

export { Telegramcontroller };