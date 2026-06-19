import * as path from "path";
import * as fs from "fs";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const findFreeRoomsTool = tool(
    async (input) => {
        try {
            const dataDir = path.resolve(process.cwd(), "src", "data");

            if (!fs.existsSync(dataDir)) {
                return `Error: The data directory ${dataDir} does not exist.`;
            }

            const roomsFilePath = path.join(dataDir, "AvailableRooms.txt");

            if (!fs.existsSync(roomsFilePath)) {
                return `Error: The master room list file "AvailableRooms.txt" could not be found in ${dataDir}.`;
            }
            const rawRooms = fs.readFileSync(roomsFilePath, "utf-8")
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean);

            const ROOM_MAP = new Map<string, Set<string>>();

            for (const line of rawRooms) {
                const match = line.match(/room\s*(\d+)/i);

                if (match) {
                    const key = match[1];

                    if (!ROOM_MAP.has(key)) {
                        ROOM_MAP.set(key, new Set());
                    }

                    ROOM_MAP.get(key)!.add(line);
                }
            }

            if (ROOM_MAP.size === 0) {
                return `Error: No valid rooms found in availableroom.txt.`;
            }
            const scheduleFiles = fs.readdirSync(dataDir).filter(file => {
                return file.endsWith(".txt") &&
                    file.toLowerCase() !== "availableroom.txt";
            });

            if (scheduleFiles.length === 0) {
                return `Warning: No schedule text files were found in the data directory.`;
            }
            const normalizeTime = (time: string) =>
                time.trim().replace(/^(\d):/, "0$1:");

            const PERIOD_MAP: Record<string, string> = {
                "08:30": "Period 1 (08:30 – 09:30)",
                "09:40": "Period 2 (09:40 – 10:40)",
                "10:50": "Period 3 (10:50 – 11:50)",
                "12:40": "Period 4 (12:40 – 13:40)",
                "13:50": "Period 5 (13:50 – 14:50)",
                "15:00": "Period 6 (15:00 – 16:00)",
            };

            const getPeriodLabel = (time: string) => {
                const startTime = normalizeTime(time.split(/[–—\-]/)[0].trim());
                return PERIOD_MAP[startTime] ?? `🕒 ${time}`;
            };

            const targetDay = input.day.toLowerCase().trim();
            const targetTime = normalizeTime(input.time.toLowerCase());

            const occupiedRoomNumbers = new Set<string>();
            for (const file of scheduleFiles) {

                const filePath = path.join(dataDir, file);
                const lines = fs.readFileSync(filePath, "utf-8").split("\n");

                let currentDay = "";
                let inTargetSlot = false;

                for (const line of lines) {
                    if (!line.trim()) continue;
                    if (
                        line.includes("━━━━━━━━") ||
                        line.includes("📅") ||
                        line.includes("📚") ||
                        line.includes("🍽")
                    ) continue;
                    const lowerLine = line.toLowerCase();
                    const dayMatch = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(lowerLine);

                    if (dayMatch) {
                        currentDay = dayMatch[1];
                        inTargetSlot = false;
                        continue;
                    }
                    if (currentDay !== targetDay) continue;
                    if (lowerLine.includes("🕐")) {
                        const normalized = lowerLine.replace(/[–—]/g, "-");
                        inTargetSlot = normalized.includes(targetTime);
                        continue;
                    }
                    if (inTargetSlot) {

                        const roomMatches = [...lowerLine.matchAll(/room\s*(\d+)/g)];

                        for (const match of roomMatches) {
                            occupiedRoomNumbers.add(match[1]);
                        }
                    }
                }
            }
            const freeRooms: string[] = [];
            const occupiedLabels = new Set<string>();

            const isSpecialRoom = (label: string) =>
                /\(e-lab\)|\(phy-lab\)|\(request\)/i.test(label);

            for (const [roomNumber, labels] of ROOM_MAP.entries()) {

                if (!occupiedRoomNumbers.has(roomNumber)) {
                    for (const label of labels) {
                        if (!isSpecialRoom(label)) {
                            freeRooms.push(label);
                        }
                    }
                } else {
                    for (const label of labels) {
                        occupiedLabels.add(label);
                    }
                }
            }
            if (freeRooms.length === 0) {
                return `Checked ${scheduleFiles.length} schedules. All rooms are occupied on ${input.day} at ${input.time}.`;
            }

            let result =
                `Successfully verified availability across ${scheduleFiles.length} schedule files.\n\n`;

            result += `📅 Day: ${input.day}\n`;
            result += `⏰ ${getPeriodLabel(input.time)}\n\n`;

            result += `✅ Available Free Rooms:\n`;
            result += freeRooms.map(r => `- ${r}`).join("\n");

            if (occupiedLabels.size > 0) {
                result += `\n\n🚫 Occupied Rooms:\n` +
                    Array.from(occupiedLabels).join(", ");
            }

            return result;

        } catch (error) {
            return `Failed to calculate free rooms. Error: ${String(error)}`;
        }
    },
    {
        name: "find_free_rooms",
        description:
            "Fast timetable scanner that finds available rooms for a given day and time.",
        schema: z.object({
            day: z.string().describe("Day of the week (e.g. Monday)"),
            time: z.string().describe("Start time (e.g. 08:30, 13:50)")
        })
    }
);