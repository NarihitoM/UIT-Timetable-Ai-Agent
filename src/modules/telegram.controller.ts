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
                text.startsWith("/Section A") ||
                text.startsWith("/Section B") ||
                text.startsWith("/Section C") ||
                text.startsWith("/Section D")
            ) {
                const eventStream = await TelegramTimetableagent.streamEvents(
                    { messages: [new HumanMessage(text)] },
                    { version: "v2" }
                );

                let statusMessageId: number | null = null;
                let finalAnswer = "";

                for await (const event of eventStream) {
                    if (event.event === "on_chain_start" && event.metadata?.langgraph_node) {
                        const nodeName = event.metadata.langgraph_node;

                        if (nodeName === "Main Agent") continue;

                        const statusMessage = nodeName.includes("Tools")
                            ? `${nodeName.replace("Tools", "").trim()} is currently executing tools...`
                            : `${nodeName} is processing your request...`;

                        if (statusMessageId === null) {
                            const sentMessage = await bot.sendMessage(chatid, statusMessage);
                            statusMessageId = sentMessage.message_id;
                        } else {
                            try {
                                await bot.editMessageText(statusMessage, {
                                    chat_id: chatid,
                                    message_id: statusMessageId
                                });
                            } catch (error) {
                                console.error("Telegram edit error:", error);
                            }
                        }
                    }

                    if (event.event === "on_chain_end" && event.metadata?.langgraph_node === "Main Agent") {
                        const outputMessages = event.data?.output?.messages;
                        if (outputMessages && outputMessages.length > 0) {
                            finalAnswer = outputMessages[outputMessages.length - 1].content || "";
                        }
                    }
                }

                if (statusMessageId !== null && finalAnswer) {
                    try {
                        await bot.editMessageText(finalAnswer, {
                            chat_id: chatid,
                            message_id: statusMessageId
                        });
                    } catch (error) {
                        await bot.sendMessage(chatid, finalAnswer);
                    }
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