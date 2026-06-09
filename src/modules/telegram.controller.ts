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
    ) => {
        try {
            //catch input from user from message and channel
            const currentMessage = req.body.message || req.body.channel_post;
            const chatid = currentMessage?.chat?.id;
            const text = currentMessage?.text;

            const cachekey = `telegram:cache${chatid}`

            const data = await redisclient.get(cachekey);

            if (data) {
                const timeleft = await redisclient.ttl(cachekey);
                bot.sendMessage(chatid, `Please wait ${timeleft} before sending again.`)
                return res.status(200).json({
                    success: true
                });
            }


            //Condition
            if (text.startsWith(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can now get started.")
            }
            else if (text.startsWith(Telegramcontroller.commands[1])) {
                await bot.sendMessage(chatid, "You can use commands /Section A,/Section B,/Section C,/Section D for each timetable.");
            }
            else if (
                text.startsWith(Telegramcontroller.commands[2]) ||
                text.startsWith(Telegramcontroller.commands[3]) ||
                text.startsWith(Telegramcontroller.commands[4]) ||
                text.startsWith(Telegramcontroller.commands[5])
            ) {
                const waitMessage = await bot.sendMessage(chatid, "Please wait while agent is running.");

                const result = await TelegramTimetableagent.invoke(
                    { messages: [new HumanMessage(text)] }
                );

                const finalAnswer = result.messages[result.messages.length - 1].content as string;

                await bot.editMessageText(finalAnswer, {
                    chat_id: chatid,
                    message_id: waitMessage.message_id
                });
            }

            
            await redisclient.set(cachekey, `Set User: ${chatid}`, {
                EX: 60
            })

            return res.status(200).json({
                success: true
            });
        }
        catch (err: unknown) {
            //Error
            console.error("Telegram Controller Error:", err);
            const currentMessage = req.body?.message || req.body?.channel_post;
            const chatid = currentMessage?.chat?.id;

            await bot.sendMessage(chatid, "It seems something went wrong.")

            return res.status(500).json({
                success: false,
                error: "Internal Server Error"
            });
        }
    }
}

export {
    Telegramcontroller
}