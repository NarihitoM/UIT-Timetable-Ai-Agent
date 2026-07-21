import { describe, it, expect, beforeEach, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("./telegram.model.ts", () => ({
    submodel: { invoke: invokeMock },
}));

import TelegramTimetableagent, { extractFinalAnswer } from "./telegram.workflow.ts";

beforeEach(() => {
    invokeMock.mockReset();
});

describe("extractFinalAnswer", () => {
    it("returns the agent's reply, not the echoed input (Bug 1 regression guard)", async () => {
        invokeMock.mockResolvedValue(new AIMessage("MOCKED ANSWER"));

        const result = await TelegramTimetableagent.invoke({
            messages: [new HumanMessage("/sem2_a")],
        });
        const answer = extractFinalAnswer(result);

        expect(answer).toBe("MOCKED ANSWER");
        expect(answer).not.toBe("/sem2_a");
    });

    it.each(["/sem6_a_cs", "sem6acs", "/room"])(
        "routes %s to an agent and returns its (mocked) answer",
        async (input) => {
            invokeMock.mockResolvedValue(new AIMessage(`answer for ${input}`));

            const result = await TelegramTimetableagent.invoke({
                messages: [new HumanMessage(input)],
            });

            expect(extractFinalAnswer(result)).toBe(`answer for ${input}`);
        }
    );

    it("falls back gracefully for unmatched input, without echoing it", async () => {
        const result = await TelegramTimetableagent.invoke({
            messages: [new HumanMessage("gibberish text")],
        });
        const answer = extractFinalAnswer(result);

        expect(answer).not.toBe("gibberish text");
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it("uses AIMessage (not HumanMessage) for the invoke-failure fallback (Bug 3 regression guard)", async () => {
        invokeMock.mockRejectedValue(new Error("groq down"));

        const result = await TelegramTimetableagent.invoke({
            messages: [new HumanMessage("/sem2_a")],
        });
        const last = result.messages.at(-1);

        expect(last).toBeInstanceOf(AIMessage);
        expect(extractFinalAnswer(result)).not.toBe("/sem2_a");
    });
});
