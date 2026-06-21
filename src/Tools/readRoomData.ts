import { tool } from "langchain";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { DATA_DIR } from "../constants.ts";

export const readRoomDataTool = tool(async () => {
    try {
        return fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, "AvailableRooms.txt"), "utf-8");
    } catch {
        return "Could not read room data.";
    }
}, {
    name: "read_room_data",
    description: "Read the list of all available rooms",
    schema: z.object({})
});
