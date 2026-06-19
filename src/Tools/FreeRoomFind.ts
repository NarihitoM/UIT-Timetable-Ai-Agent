import * as path from "path";
import * as fs from "fs";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

interface RoomEntry {
    number: string;
    label: string;
    tags: string[];
}

const DATA_DIR = path.resolve(process.cwd(), "src", "data");
const ROOMS_FILE = "AvailableRooms.txt";

const SPECIAL_TAG_REGEX = /\(e-lab\)|\(phy-lab\)|\(request\)/i;

function loadAllRooms(): Map<string, RoomEntry[]> {
    const map = new Map<string, RoomEntry[]>();
    const filePath = path.join(DATA_DIR, ROOMS_FILE);

    if (!fs.existsSync(filePath)) return map;

    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        const numMatch = line.match(/Room\s+(\d+)/i);
        if (!numMatch) continue;

        const num = numMatch[1];
        const tags: string[] = [];
        if (/\(e-lab\)/i.test(line)) tags.push("E-Lab");
        if (/\(phy-lab\)/i.test(line)) tags.push("Phy-Lab");
        if (/\(request\)/i.test(line)) tags.push("Request");

        const entry: RoomEntry = { number: num, label: line, tags };
        if (!map.has(num)) map.set(num, []);
        map.get(num)!.push(entry);
    }
    return map;
}

function isSpecialRoom(entry: RoomEntry): boolean {
    return entry.tags.length > 0;
}

function extractRoomNumbersFromLine(line: string): string[] {
    const numbers: string[] = [];

    const matches = [...line.matchAll(/Room\s+(\d+)/gi)];
    for (const m of matches) {
        numbers.push(m[1]);
    }

    return numbers;
}

function normalizeDay(input: string): string {
    const lower = input.toLowerCase().trim();
    const dayMap: Record<string, string> = {
        "mon": "monday", "tue": "tuesday", "wed": "wednesday",
        "thu": "thursday", "fri": "friday", "sat": "saturday", "sun": "sunday",
        "monday": "monday", "tuesday": "tuesday", "wednesday": "wednesday",
        "thursday": "thursday", "friday": "friday", "saturday": "saturday", "sunday": "sunday",
    };
    return dayMap[lower] || lower;
}

function normalizeTimeInput(time: string): string {
    const trimmed = time.trim();

    const rangeMatch = trimmed.match(/^(\d{1,2}:\d{2})\s*[\-–—]\s*\d{1,2}:\d{2}$/);
    if (rangeMatch) {
        const h = rangeMatch[1].split(":")[0];
        const m = rangeMatch[1].split(":")[1];
        return `${h.padStart(2, "0")}:${m}`;
    }

    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return trimmed;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function timeRangeContains(rangeLine: string, targetTime: string): boolean {
    const normalized = rangeLine
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ");

    const timePattern = targetTime.replace(":", "\\:");
    const regex = new RegExp(`🕐\\s*${timePattern}\\s*-`, "i");
    return regex.test(normalized);
}

export const findFreeRoomsTool = tool(
    async (input) => {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                return `Error: Data directory not found at ${DATA_DIR}`;
            }

            const allRooms = loadAllRooms();
            if (allRooms.size === 0) {
                return `Error: No rooms found in ${ROOMS_FILE}.`;
            }

            const scheduleFiles = fs.readdirSync(DATA_DIR).filter(f =>
                f.endsWith(".txt") && f.toLowerCase() !== ROOMS_FILE.toLowerCase()
            );

            if (scheduleFiles.length === 0) {
                return `Error: No schedule files found in ${DATA_DIR}.`;
            }

            const targetDay = normalizeDay(input.day);
            const targetTime = normalizeTimeInput(input.time);

            const occupiedRoomNumbers = new Set<string>();

            for (const file of scheduleFiles) {
                const filePath = path.join(DATA_DIR, file);
                const content = fs.readFileSync(filePath, "utf-8");
                const lines = content.split("\n");

                let currentDay = "";
                let inTargetSlot = false;

                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;

                    if (
                        line.includes("━━━━") ||
                        line.includes("📅") ||
                        line.includes("📚") && line.includes("Subject")
                    ) continue;

                    const dayMatch = /📆\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.exec(line);
                    if (dayMatch) {
                        currentDay = dayMatch[1].toLowerCase();
                        inTargetSlot = false;
                        continue;
                    }

                    if (currentDay !== targetDay) continue;

                    if (line.includes("🕐")) {
                        inTargetSlot = timeRangeContains(line, targetTime);
                        continue;
                    }

                    if (line.includes("🍽") || line.includes("Lunch")) {
                        inTargetSlot = false;
                        continue;
                    }

                    if (inTargetSlot) {
                        if (/❌\s*No Class/i.test(line)) {
                            continue;
                        }

                        const roomNums = extractRoomNumbersFromLine(line);
                        for (const num of roomNums) {
                            occupiedRoomNumbers.add(num);
                        }
                    }
                }
            }

            const freeRooms: string[] = [];

            for (const [roomNum, entries] of allRooms.entries()) {
                if (!occupiedRoomNumbers.has(roomNum)) {
                    for (const entry of entries) {
                        if (!isSpecialRoom(entry)) {
                            freeRooms.push(entry.label);
                        }
                    }
                }
            }

            freeRooms.sort((a, b) => {
                const numA = parseInt(a.match(/Room\s+(\d+)/)?.[1] || "0", 10);
                const numB = parseInt(b.match(/Room\s+(\d+)/)?.[1] || "0", 10);
                return numA - numB;
            });

            if (freeRooms.length === 0) {
                return `Checked ${scheduleFiles.length} schedule files. All rooms in ${ROOMS_FILE} are occupied on ${input.day} at ${input.time}.`;
            }

            const result = [
                `Scanned ${scheduleFiles.length} schedule files for room usage.`,
                ``,
                `📅 Day: ${input.day}`,
                `⏰ Time: ${input.time}`,
                ``,
                `✅ Available Free Rooms (${freeRooms.length}):`,
                ...freeRooms.map(r => `- ${r}`),
            ];

            return result.join("\n");

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return `Failed to calculate free rooms. Error: ${msg}`;
        }
    },
    {
        name: "find_free_rooms",
        description:
            "Fast timetable scanner that finds available rooms for a given day and time.",
        schema: z.object({
            day: z.string().describe("Day of the week (e.g. Monday, Friday)"),
            time: z.string().describe("Start time in HH:MM format (e.g. 08:30, 09:40, 13:50)")
        })
    }
);
