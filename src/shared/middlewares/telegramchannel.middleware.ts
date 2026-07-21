import { type NextFunction, type Request, type Response } from "express";

class BaseMiddleware {
    public static Telegrammiddleware = async (
        req: Request,
        res: Response,
        next : NextFunction
    ) => {
        try {
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