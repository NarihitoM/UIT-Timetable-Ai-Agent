import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";


export const readSem4BTool = tool(
    async (input) => {
        try {
            const filePath = path.resolve(process.cwd(),"src" , "data", "Sem4B.txt");

            if (!fs.existsSync(filePath)) {
                return `Error: The file "Sem4B.txt" could not be found in the data/ directory.`;
            }

            const fileContent = fs.readFileSync(filePath, "utf-8");

            if (input.query && input.query.trim() !== "") {
                const lines = fileContent.split("\n");
                const lowerQuery = input.query.toLowerCase();
                const matchedLines = lines.filter(line => line.toLowerCase().includes(lowerQuery));

                if (matchedLines.length === 0) {
                    return `File "Sem4B.txt" read successfully. No specific matching records found for search term: "${input.query}".`;
                }
                return `File "Sem4B.txt" read successfully. Filtered matches for "${input.query}":\n\n${matchedLines.join("\n")}`;
            }

            return `Successfully read Sem4B.txt data contents:\n\n${fileContent}`;

        } catch (error) {
            return `Failed to read Sem4B.txt. Error details: ${String(error)}`;
        }
    },
    {
        name: "read_sem4_b_file",
        description: "Sem4B = Semester 4 Section B. Use this tool to read, parse, or lookup information inside the Sem4B timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
        schema: z.object({
            query: z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Sem4B.txt.")
        })
    }
);
