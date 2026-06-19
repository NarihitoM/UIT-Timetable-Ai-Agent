import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";


export const readSem4DTool = tool(
    async (input) => {
        try {
            const filePath = path.resolve(process.cwd(), "src", "data", "Sem4D.txt");

            if (!fs.existsSync(filePath)) {
                return `Error: Sem4D.txt not found.`;
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
            return `Error reading Sem4D.txt: ${String(error)}`;
        }
    },
    {
        name: "read_sem4_d_file",
        description: "Sem4D = Semester 4 Section D. Use this tool to read, parse, or lookup information inside the Sem4D timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
        schema: z.object({
            query: z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Sem4D.txt.")
        })
    }
);
