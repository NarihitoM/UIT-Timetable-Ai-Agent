import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const readSem2ETool = tool(
    async (input) => {
        try {
            const filePath = path.resolve(process.cwd(), "src" ,"data", "Sem2E.txt");

            if (!fs.existsSync(filePath)) {
                return `Error: Sem2E.txt not found.`;
            }

            const fileContent = fs.readFileSync(filePath, "utf-8");

            if (input.query && input.query.trim() !== "") {
                const lines = fileContent.split("\n");
                const lowerQuery = input.query.toLowerCase();
                const matchedLines = lines.filter(line => line.toLowerCase().includes(lowerQuery));

                if (matchedLines.length === 0) {
                    return `No matches found for "${input.query}".`;
                }
                return matchedLines.join("\n");
            }

            return fileContent;

        } catch (error) {
            return `Error reading Sem2E.txt: ${String(error)}`;
        }
    },
    {
        name: "read_sem2_e_file",
        description: "Sem2E = Semester 2 Section E. Use this tool to read, parse, or lookup information inside the Sem2E timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
        schema: z.object({
            query: z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Sem2E.txt.")
        })
    }
);

