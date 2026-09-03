import { describe, it, expect } from "vitest";
import { toTelegramMarkdown } from "./format.ts";
import { getTimeContextPrompt } from "../prompt/systemprompt.ts";

describe("toTelegramMarkdown", () => {
    it("escapes the characters MarkdownV2 would choke on", () => {
        const out = toTelegramMarkdown("Room B-204 (Lab) costs 5.5 hours!");
        for (const ch of ["-", "(", ")", ".", "!"]) {
            expect(out).toContain(`\\${ch}`);
        }
    });

    it("keeps bold markers usable rather than escaping them away", () => {
        expect(toTelegramMarkdown("**CS101** is next")).toContain("*CS101*");
    });

    it("never throws on the odd things a model emits", () => {
        for (const input of ["", "```\nunclosed", "*", "_a_ [x](y", "🕐📚🚪"]) {
            expect(() => toTelegramMarkdown(input)).not.toThrow();
        }
    });
});

describe("getTimeContextPrompt", () => {
    it("reports Myanmar time, not the server's UTC clock", () => {
        // 18:00 UTC is 00:30 the next day in Yangon (UTC+6:30)
        const prompt = getTimeContextPrompt(new Date("2026-09-03T18:00:00Z"));

        expect(prompt).toContain("00:30");
        expect(prompt).toContain("Friday");
        expect(prompt).toContain("04 September 2026");
    });
});
