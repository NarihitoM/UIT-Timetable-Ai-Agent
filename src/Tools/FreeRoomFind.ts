import { tool } from "@langchain/core/tools";
import * as path from "path";
import * as fs from "fs";
import { z } from "zod";

export const findFreeRoomsTool = tool(
    async (input) => {
        try {
            const dataDir = path.resolve(process.cwd(), "src", "data");
            const roomsFilePath = path.join(dataDir, "AvailableRooms.txt");
            if (!fs.existsSync(roomsFilePath)) {
                return `Error: The master room list file "availableroom.txt" could not be found in ${dataDir}.`;
            }

            const ALL_ROOMS = fs.readFileSync(roomsFilePath, "utf-8")
                .split("\n")
                .map(room => room.trim())
                .filter(room => room.length > 0);

            if (ALL_ROOMS.length === 0) {
                return `Error: "availableroom.txt" was read successfully, but it contains no room names.`;
            }

            if (!fs.existsSync(dataDir)) {
                return `Error: The data directory ${dataDir} does not exist.`;
            }
            const scheduleFiles = fs.readdirSync(dataDir).filter(file => {
                return file.endsWith(".txt") && file.toLowerCase() !== "availableroom.txt";
            });

            if (scheduleFiles.length === 0) {
                return `Warning: No schedule text files were found in the data directory.`;
            }
            const targetDay = input.day.toLowerCase().trim();
            const targetTime = input.time.toLowerCase().trim();
            const occupiedRooms = new Set<string>();
            for (const sectionFile of scheduleFiles) {
                const filePath = path.join(dataDir, sectionFile);
                const lines = fs.readFileSync(filePath, "utf-8").split("\n");

                let currentReadingDay = "";
                let inTargetTimeSlot = false;

                for (const line of lines) {
                    const lowerLine = line.toLowerCase();
                    if (
                        lowerLine.includes("monday") || 
                        lowerLine.includes("tuesday") || 
                        lowerLine.includes("wednesday") || 
                        lowerLine.includes("thursday") || 
                        lowerLine.includes("friday") ||
                        lowerLine.includes("saturday") ||
                        lowerLine.includes("sunday")
                    ) {
                        currentReadingDay = lowerLine;
                        inTargetTimeSlot = false;
                        continue;
                    }
                    if (currentReadingDay.includes(targetDay)) {
                        if (lowerLine.includes(":") && (lowerLine.includes("–") || lowerLine.includes("-"))) {
                            if (lowerLine.includes(targetTime)) {
                                inTargetTimeSlot = true;
                            } else {
                                inTargetTimeSlot = false;
                            }
                            continue;
                        }
                        if (inTargetTimeSlot) {
                            for (const room of ALL_ROOMS) {
                                if (lowerLine.includes(room.toLowerCase())) {
                                    occupiedRooms.add(room);
                                }
                            }
                        }
                    }
                }
            }
            const freeRooms = ALL_ROOMS.filter(room => !occupiedRooms.has(room));
            if (freeRooms.length === 0) {
                return `Checked ${scheduleFiles.length} schedules. All rooms are occupied on ${input.day} at ${input.time}.`;
            }

            let responseText = `Successfully verified availability across ${scheduleFiles.length} schedule files.\n\n`;
            responseText += `📅 **Day:** ${input.day}\n🕒 **Time:** ${input.time}\n\n`;
            responseText += `✅ **Available Free Rooms:**\n${freeRooms.map(room => `- ${room}`).join("\n")}\n\n`;
            
            if (occupiedRooms.size > 0) {
                responseText += `🚫 **Occupied Rooms:** ${Array.from(occupiedRooms).join(", ")}\n`;
            }

            return responseText;

        } catch (error) {
            return `Failed to calculate free rooms. Error details: ${String(error)}`;
        }
    },
    {
        name: "find_free_rooms",
        description: "Scans multi-line text schedules dynamically to find unbooked rooms for a specific day and time, automatically reading all .txt files in the data folder.",
        schema: z.object({
            day: z.string().describe("Day of the week (e.g., 'Monday', 'Tuesday')"),
            time: z.string().describe("Start time of the class block to look up (e.g., '08:30', '13:50', '09:40')")
        })
    }
);