import { type NextFunction, type Request, type Response } from "express";

class BaseMiddleware {
    // /webhook is a public url, so anything can post a fake update to it. Telegram sends
    // this header on every call when the webhook was registered with a secret_token.
    public static Telegrammiddleware = async (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

        if (!secret) {
            console.error("TELEGRAM_WEBHOOK_SECRET is not set, refusing to trust the webhook");
            return res.status(401).send("Unauthorized");
        }

        if (req.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
            return res.status(401).send("Unauthorized");
        }

        next();
    }
}

export {
    BaseMiddleware
}
