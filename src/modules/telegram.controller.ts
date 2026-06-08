import { HumanMessage } from "@langchain/core/messages";
import TelegramTimetableagent from "../Agent/telegram.workflow.ts";
import bot from "../lib/telegram.ts";
import { Telegramcommand } from "./telegram.command.ts";
import { type Request, type Response } from "express";


class Telegramcontroller extends Telegramcommand {
    public static telegram = async (
        req: Request,
        res: Response
    ) => {
        try {
            //catch input from user
            const chatid = req.body.message?.chat?.id;
            const text = req.body.message?.text;

            if (text.startsWith(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can use commands /Section A,/Section B,/Section C,/Section D for each timetable.");
            }
            else if (
                text.startsWith("/section_a") ||
                text.startsWith("/section_b") ||
                text.startsWith("/section_c") ||
                text.startsWith("/section_d")
            ) {
                const waitMessage = await bot.sendMessage(chatid, "Please wait while agent is running.");

                const result = await TelegramTimetableagent.invoke(
                    { messages: [new HumanMessage(text)] }
                );

                const finalAnswer = result.messages[result.messages.length - 1].content as string;

                try {
                    await bot.editMessageText(finalAnswer, {
                        chat_id: chatid,
                        message_id: waitMessage.message_id
                    });
                } catch (_) {
                    await bot.sendMessage(chatid, finalAnswer);
                }
            }

            return res.status(200).json({
                success: true
            });
        }
        catch (err: unknown) {
            //Error
            console.error("Telegram Controller Error:", err);
            const chatid = req.body?.message?.chat?.id;

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