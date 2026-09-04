import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { BaseMiddleware } from "./telegramchannel.middleware.ts";

function makeRes(): Response {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.send = vi.fn(() => res);
    return res as Response;
}

function makeReq(header?: string): Request {
    return { get: (name: string) => (name === "X-Telegram-Bot-Api-Secret-Token" ? header : undefined) } as Request;
}

beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "the-real-secret";
});

describe("Telegrammiddleware", () => {
    it("lets a request carrying the right secret through", async () => {
        const next = vi.fn() as unknown as NextFunction;
        const res = makeRes();

        await BaseMiddleware.Telegrammiddleware(makeReq("the-real-secret"), res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects a forged update with no secret or the wrong one", async () => {
        for (const header of [undefined, "", "guessed"]) {
            const next = vi.fn() as unknown as NextFunction;
            const res = makeRes();

            await BaseMiddleware.Telegrammiddleware(makeReq(header), res, next);

            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(401);
        }
    });

    it("rejects everything when the secret was never configured", async () => {
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
        const next = vi.fn() as unknown as NextFunction;
        const res = makeRes();

        await BaseMiddleware.Telegrammiddleware(makeReq(undefined), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
