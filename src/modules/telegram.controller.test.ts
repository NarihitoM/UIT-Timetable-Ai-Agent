import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

const { sendMessageMock, editMessageTextMock, invokeMock, redisMock, redisState } = vi.hoisted(() => {
    const store = new Map<string, { expiresAt: number }>();
    return {
        sendMessageMock: vi.fn(),
        editMessageTextMock: vi.fn(),
        invokeMock: vi.fn(),
        redisState: store,
        redisMock: { set: vi.fn(), del: vi.fn(), ttl: vi.fn() },
    };
});

vi.mock("../lib/telegram.ts", () => ({
    default: { sendMessage: sendMessageMock, editMessageText: editMessageTextMock },
}));

vi.mock("../lib/redis.ts", () => ({ redisclient: redisMock }));

vi.mock("../lib/memory.ts", () => ({
    loadHistory: vi.fn(async () => []),
    saveTurn: vi.fn(async () => undefined),
}));

vi.mock("../Agent/telegram.workflow.ts", () => ({
    default: { invoke: invokeMock },
    extractFinalAnswer: (result: any) => result?.answer ?? "mocked answer",
}));

import { Telegramcontroller } from "./telegram.controller.ts";

function makeRes(): Response {
    const res: any = {};
    res.status = vi.fn(() => res);
    res.send = vi.fn(() => res);
    return res as Response;
}

function makeReq(chatId: number, text: string): Request {
    return { body: { message: { chat: { id: chatId }, text } } } as unknown as Request;
}

beforeEach(() => {
    vi.clearAllMocks();
    redisState.clear();

    sendMessageMock.mockResolvedValue({ message_id: 42 });
    editMessageTextMock.mockResolvedValue(true);
    invokeMock.mockResolvedValue({ answer: "mocked answer" });

    redisMock.set.mockImplementation(async (key: string, _value: string, opts?: { NX?: boolean; EX?: number }) => {
        const now = Date.now();
        const existing = redisState.get(key);
        if (existing && existing.expiresAt > now) return null;
        redisState.set(key, { expiresAt: now + (opts?.EX ?? 15) * 1000 });
        return "OK";
    });
    redisMock.del.mockImplementation(async (key: string) => {
        redisState.delete(key);
        return 1;
    });
    redisMock.ttl.mockImplementation(async (key: string) => {
        const existing = redisState.get(key);
        if (!existing) return -2;
        return Math.max(0, Math.ceil((existing.expiresAt - Date.now()) / 1000));
    });
});

describe("Telegramcontroller.telegram", () => {
    it("releases the rate-limit lock only after delivering the answer (Bug 2 regression guard)", async () => {
        const order: string[] = [];
        invokeMock.mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 5));
            return { answer: "mocked answer" };
        });
        editMessageTextMock.mockImplementation(async () => {
            order.push("editMessageText");
            return true;
        });
        redisMock.del.mockImplementation(async (key: string) => {
            order.push("del");
            redisState.delete(key);
            return 1;
        });

        await Telegramcontroller.telegram(makeReq(111, "/sem2_a"), makeRes());

        expect(order).toEqual(["editMessageText", "del"]);
        expect(editMessageTextMock).toHaveBeenCalledWith(
            expect.stringContaining("mocked answer"),
            expect.objectContaining({ chat_id: 111, parse_mode: "MarkdownV2" })
        );
    });

    it("rejects a second request for the same chat while the first is still holding the lock", async () => {
        let resolveInvoke: (v: unknown) => void = () => {};
        invokeMock.mockImplementation(
            () => new Promise((resolve) => { resolveInvoke = resolve; })
        );

        const firstCall = Telegramcontroller.telegram(makeReq(222, "/sem2_a"), makeRes());
        // Let the first request acquire the lock and reach the (paused) invoke call.
        await new Promise((r) => setTimeout(r, 0));

        await Telegramcontroller.telegram(makeReq(222, "/sem2_a"), makeRes());

        expect(sendMessageMock).toHaveBeenCalledWith(222, expect.stringContaining("Do Not Spam"));

        resolveInvoke({ answer: "mocked answer" });
        await firstCall;
    });

    it("lets a second request through once the first has fully completed", async () => {
        await Telegramcontroller.telegram(makeReq(333, "/sem2_a"), makeRes());
        await Telegramcontroller.telegram(makeReq(333, "/sem2_a"), makeRes());

        expect(sendMessageMock).not.toHaveBeenCalledWith(333, expect.stringContaining("Do Not Spam"));
        expect(invokeMock).toHaveBeenCalledTimes(2);
    });
});
