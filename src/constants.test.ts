import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { SECTIONS, DATA_DIR } from "./constants.ts";
import { Telegramcommand } from "./modules/telegram.command.ts";

describe("SECTIONS", () => {
    it("every section's data file exists on disk", () => {
        for (const section of SECTIONS) {
            const filePath = path.resolve(process.cwd(), DATA_DIR, section.file);
            expect(fs.existsSync(filePath), `${section.file} should exist`).toBe(true);
        }
    });

    it("every command starts with /", () => {
        for (const section of SECTIONS) {
            expect(section.command.startsWith("/")).toBe(true);
        }
    });

    it("keys are unique", () => {
        const keys = SECTIONS.map((s) => s.key);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe("Telegramcommand.commands", () => {
    it("contains exactly the fixed commands, every section command, and /room last", () => {
        const expected = [
            "/start",
            "/help",
            "/contributors",
            "/sourcecode",
            ...SECTIONS.map((s) => s.command),
            "/room",
        ];
        expect(Telegramcommand.commands).toEqual(expected);
    });
});
