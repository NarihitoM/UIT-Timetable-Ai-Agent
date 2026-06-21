import { tool } from "langchain";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { FILE_NAMES, DATA_DIR } from "../constants.ts";

export const readTimetableTool = tool(async ({ section }) => {
    const name = section.trim();
    const file = FILE_NAMES[name];
    if (!file) return `Unknown section: ${name}`;
    try {
        return fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, file), "utf-8");
    } catch {
        return "Could not read file.";
    }
}, {
    name: "read_timetable",
    description: "Read timetable data for a specific section",
    schema: z.object({ section: z.string() })
});
