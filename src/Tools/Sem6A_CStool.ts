import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

export const readSem6A_CSTool = tool(
    async (input) => {
        try {
            const filePath = path.resolve(process.cwd(), "src" ,"data", "Sem6A_CS.txt");

            if (!fs.existsSync(filePath)) {
                return `Error: Sem6A_CS.txt not found.`;
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
            return `Error reading Sem6A_CS.txt: ${String(error)}`;
        }
    },
    {
        name: "read_sem6_a_cs_file",
        description: "Sem6A_CS = Semester 6 Section A (CS). Use this tool to read, parse, or lookup information inside the Sem6A_CS timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
        schema: z.object({
            query: z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Sem6A_CS.txt.")
        })
    }
);
