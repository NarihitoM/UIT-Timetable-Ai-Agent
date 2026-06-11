import { NextFunction, type Request, type Response } from "express";
import bot from "../../lib/telegram.ts";

class BaseMiddleware {
    public static Telegrammiddleware = async (
        req: Request,
        res: Response,
        next : NextFunction
    ) => {
        try {
            const currentMessage = req.body?.message || req.body?.channel_post || {};
            const chatid = currentMessage?.chat?.id;

            /* Paid Mode Coming Soon.
            if(chatid !== Number(process.env.CHANNEL)){
                await bot.sendMessage(chatid , "You do not have permission to use Timetable. Only Team SE Gp can use.")
                return res.status(200).send("Ok")
            } */

            //Next
            next()
        }
        catch (err: unknown) {
            //Error
            console.log(err);
            return res.status(200).send("Ok")
        }
    }
}

export {
    BaseMiddleware
}