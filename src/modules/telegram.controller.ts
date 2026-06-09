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

            if (Telegramcontroller.commands[0] && text.includes(Telegramcontroller.commands[0])) {
                await bot.sendMessage(chatid, "You can start. Dont make me talk too much Ok. Mf has been eager to run me huh now lets see.");
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[1] && text.includes(Telegramcontroller.commands[1])) {
                await bot.sendMessage(chatid, "Help Ahhh! Im drowning and dying. YAMETE KUDASAI ");
                return res.status(200).send("OK");
            }

            if (Telegramcontroller.commands[2] && text.includes(Telegramcontroller.commands[2])) {
                await bot.sendMessage(chatid, "Contributors: Special thanks to Velluz(Hein Thu Aung) for openai api key.");
                return res.status(200).send("OK");
            }

            if (
                (Telegramcontroller.commands[3] && text.includes(Telegramcontroller.commands[3])) ||
                (Telegramcontroller.commands[4] && text.includes(Telegramcontroller.commands[4])) ||
                (Telegramcontroller.commands[5] && text.includes(Telegramcontroller.commands[5])) ||
                (Telegramcontroller.commands[6] && text.includes(Telegramcontroller.commands[6]))
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

                await redisclient.set(cachekey, `Set User: ${chatid}`, {
                    EX: 60
                });

                return res.status(200).send("OK");
            }

            await bot.sendMessage(chatid, "TF you typing for There is no fucking function with that fucking name.");
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