import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

const { sendMessageMock, sendChatActionMock, editMessageTextMock, invokeMock, redisMock, redisState } = vi.hoisted(() => {
    const store = new Map<string, { expiresAt: number }>();
    return {
        sendMessageMock: vi.fn(),
        sendChatActionMock: vi.fn(),
        editMessageTextMock: vi.fn(),
        invokeMock: vi.fn(),
        redisState: store,
        redisMock: { set: vi.fn(), get: vi.fn(), del: vi.fn(), ttl: vi.fn() },
    };
});

vi.mock("../lib/telegram.ts", () => ({
    default: { sendMessage: sendMessageMock, editMessageText: editMessageTextMock, sendChatAction: sendChatActionMock },
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

function makeReq(chatId: number, text: string, messageId?: number): Request {
    return { body: { message: { chat: { id: chatId }, text, message_id: messageId } } } as unknown as Request;
}

// A channel post the bot itself made: no `from` field, so only the message_id gives it away.
function makeOwnChannelPost(chatId: number, text: string, messageId: number): Request {
    return {
        body: { channel_post: { chat: { id: chatId }, text, message_id: messageId } }
    } as unknown as Request;
}

beforeEach(() => {
    vi.clearAllMocks();
    redisState.clear();

    sendMessageMock.mockResolvedValue({ message_id: 42 });
    editMessageTextMock.mockResolvedValue(true);
    sendChatActionMock.mockResolvedValue(true);
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
    redisMock.get.mockImplementation(async (key: string) => {
        const existing = redisState.get(key);
        return existing && existing.expiresAt > Date.now() ? "1" : null;
    });
    redisMock.ttl.mockImplementation(async (key: string) => {
        const existing = redisState.get(key);
        if (!existing) return -2;
        return Math.max(0, Math.ceil((existing.expiresAt - Date.now()) / 1000));
    });
});

describe("Telegramcontroller.telegram", () => {
    it("delivers the answer and leaves the cooldown key to expire on its own", async () => {
        invokeMock.mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 5));
            return { answer: "mocked answer" };
        });

        await Telegramcontroller.telegram(makeReq(111, "/sem2_a"), makeRes());

        expect(sendMessageMock).toHaveBeenCalledWith(
            111,
            expect.stringContaining("mocked answer"),
            expect.objectContaining({ parse_mode: "MarkdownV2" })
        );
        // Deleting it here would end the cooldown the moment the answer landed.
        expect(redisMock.del).not.toHaveBeenCalledWith("telegram:cache:111");
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

    it("shows a typing indicator instead of a wait message", async () => {
        await Telegramcontroller.telegram(makeReq(444, "/sem2_a"), makeRes());

        expect(sendChatActionMock).toHaveBeenCalledWith(444, "typing");
        expect(sendMessageMock).not.toHaveBeenCalledWith(444, expect.stringContaining("Please wait while"));
    });

    it("still answers when the typing indicator blows up", async () => {
        sendChatActionMock.mockImplementation(() => { throw new Error("sendChatAction exploded"); });

        await Telegramcontroller.telegram(makeReq(555, "/sem2_a"), makeRes());

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(sendMessageMock).toHaveBeenCalledWith(555, expect.stringContaining("mocked answer"), expect.anything());
    });

    it("keeps the cooldown after the first request finishes, so commands cannot be spammed", async () => {
        await Telegramcontroller.telegram(makeReq(333, "/sem2_a"), makeRes());
        await Telegramcontroller.telegram(makeReq(333, "/sem2_a"), makeRes());

        expect(sendMessageMock).toHaveBeenCalledWith(333, expect.stringContaining("Do Not Spam"));
        expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    it("ignores its own post coming back as a channel_post, even when it looks like a command", async () => {
        // The bot answers in a channel; Telegram hands that same post back to the webhook.
        sendMessageMock.mockResolvedValue({ message_id: 900 });
        await Telegramcontroller.telegram(makeReq(-100999, "/sem2_a", 1), makeRes());

        const sendsAfterAnswering = sendMessageMock.mock.calls.length;
        invokeMock.mockClear();

        // Worst case: the model's answer began with a slash and named a section command,
        // so the text heuristic would let it straight back into the agent branch.
        await Telegramcontroller.telegram(
            makeOwnChannelPost(-100999, "/sem2_a here is your timetable", 900),
            makeRes()
        );

        expect(invokeMock).not.toHaveBeenCalled();
        expect(sendMessageMock.mock.calls.length).toBe(sendsAfterAnswering);
    });

    it("applies the cooldown per chat, so a group shares one and other chats are unaffected", async () => {
        await Telegramcontroller.telegram(makeReq(-100777, "/sem2_a"), makeRes());
        // A different member of the same group, still the same chat id.
        await Telegramcontroller.telegram(makeReq(-100777, "/sem4_a"), makeRes());
        // An unrelated private chat must not be blocked by the group's cooldown.
        await Telegramcontroller.telegram(makeReq(888, "/sem2_a"), makeRes());

        expect(sendMessageMock).toHaveBeenCalledWith(-100777, expect.stringContaining("Do Not Spam"));
        expect(sendMessageMock).not.toHaveBeenCalledWith(888, expect.stringContaining("Do Not Spam"));
        expect(invokeMock).toHaveBeenCalledTimes(2);
    });
});
