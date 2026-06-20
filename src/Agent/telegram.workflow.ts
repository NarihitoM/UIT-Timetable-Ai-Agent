import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { mainmodel, submodel } from "./telegram.model.ts";
import { getSubAgentPrompt, getRoomAgentPrompt, getFormatterPrompt } from "../prompt/systemprompt.ts";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.resolve(process.cwd(), "src", "data");

const SECTION_NAMES: Record<string, string> = {
    "/sem2_a": "Sem2A", "/sem2_b": "Sem2B", "/sem2_c": "Sem2C", "/sem2_d": "Sem2D", "/sem2_e": "Sem2E",
    "/sem4_a": "Sem4A", "/sem4_b": "Sem4B", "/sem4_c": "Sem4C", "/sem4_d": "Sem4D",
    "/sem6_ct": "Sem6CT", "/sem6_a_cs": "Sem6A_CS", "/sem6_b_cs": "Sem6B_CS", "/sem6_c_cs": "Sem6C_CS", "/sem6_d_cs": "Sem6D_CS",
    "/sem8_se": "Sem8SE", "/sem8_ke": "Sem8KE", "/sem8_hpc": "Sem8HPC", "/sem8_es": "Sem8ES", "/sem8_ccn": "Sem8CCN", "/sem8_bis": "Sem8BIS",
};

const FILE_NAMES: Record<string, string> = {
    "Sem2A": "Sem2A.txt", "Sem2B": "Sem2B.txt", "Sem2C": "Sem2C.txt", "Sem2D": "Sem2D.txt", "Sem2E": "Sem2E.txt",
    "Sem4A": "Sem4A.txt", "Sem4B": "Sem4B.txt", "Sem4C": "Sem4C.txt", "Sem4D": "Sem4D.txt",
    "Sem6CT": "Sem6_CT.txt",
    "Sem6A_CS": "Sem6A_CS.txt", "Sem6B_CS": "Sem6B_CS.txt", "Sem6C_CS": "Sem6C_CS.txt", "Sem6D_CS": "Sem6D_CS.txt",
    "Sem8SE": "Sem8_SE.txt", "Sem8KE": "Sem8_KE.txt", "Sem8HPC": "Sem8_HPC.txt",
    "Sem8ES": "Sem8_ES.txt", "Sem8CCN": "Sem8_CCN.txt", "Sem8BIS": "Sem8_BIS.txt",
};

export function getSectionName(command: string): string | null {
    return SECTION_NAMES[command.toLowerCase()] || null;
}

function readFile(sectionName: string): string | null {
    const fileName = FILE_NAMES[sectionName];
    if (!fileName) return null;
    try {
        return fs.readFileSync(path.join(DATA_DIR, fileName), "utf-8");
    } catch {
        return null;
    }
}

export async function processSectionQuery(sectionName: string, userQuery: string): Promise<string> {
    const fileContent = readFile(sectionName);
    if (!fileContent) {
        return `DATA_ERROR: Could not load timetable for ${sectionName}.`;
    }

    const prompt = `${getSubAgentPrompt(sectionName)}\n\nTimetable data:\n${fileContent}`;

    try {
        const response = await submodel.invoke([
            new SystemMessage(prompt),
            new HumanMessage(userQuery || "Show my next class")
        ]);
        return response.content as string;
    } catch {
        return `DATA_ERROR: Failed to process query for ${sectionName}.`;
    }
}

export async function processRoomQuery(userQuery: string): Promise<string> {
    let allData = "";
    for (const [name, file] of Object.entries(FILE_NAMES)) {
        try {
            const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
            allData += `=== ${name} ===\n${content}\n\n`;
        } catch { /* skip */ }
    }

    try {
        const prompt = `${getRoomAgentPrompt()}\n\nAll timetable data:\n${allData}`;
        const response = await submodel.invoke([
            new SystemMessage(prompt),
            new HumanMessage(userQuery)
        ]);
        return response.content as string;
    } catch {
        return `DATA_ERROR: Failed to process room query.`;
    }
}

export async function processFormatter(rawData: string): Promise<string> {
    try {
        const response = await mainmodel.invoke([
            new SystemMessage(getFormatterPrompt()),
            new HumanMessage(`Raw data:\n${rawData}\n\nFormat this into a clean Telegram message with emojis.`)
        ]);
        return response.content as string;
    } catch {
        return rawData;
    }
}
