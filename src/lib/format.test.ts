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
        // 18:00 UTC is 12:30 AM the next day in Yangon (UTC+6:30)
        const prompt = getTimeContextPrompt(new Date("2026-09-03T18:00:00Z"));

        expect(prompt).toContain("12:30 AM");
        expect(prompt).toContain("Friday");
        expect(prompt).toContain("September 4, 2026");
    });

    it("carries the header line the agents are told to copy", () => {
        const prompt = getTimeContextPrompt(new Date("2026-09-03T18:00:00Z"));

        expect(prompt).toContain("📅 Friday, September 4, 2026, 12:30 AM");
    });

    it("uses AM/PM rather than a 24 hour clock", () => {
        const afternoon = getTimeContextPrompt(new Date("2026-09-03T09:20:00Z")); // 15:50 Yangon

        expect(afternoon).toContain("3:50 PM");
        expect(afternoon).not.toContain("15:50");
    });
});
