import { START, END, StateGraph } from "@langchain/langgraph";
import Telegramagentstate from "./telegram.state.ts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { submodel } from "./telegram.model.ts";
import * as fs from "fs";
import * as path from "path";
import { FILE_NAMES, DATA_DIR } from "../constants.ts";

const ROOM_FILE = "AvailableRooms.txt";

function readSection(section: string): string | null {
    const file = FILE_NAMES[section];
    if (!file) return null;
    try {
        return fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, file), "utf-8");
    } catch {
        return null;
    }
}

function readRooms(): string | null {
    try {
        return fs.readFileSync(path.resolve(process.cwd(), DATA_DIR, ROOM_FILE), "utf-8");
    } catch {
        return null;
    }
}

const sectionNames = Object.keys(FILE_NAMES);

// Build route map: "Sem2A" → "Sem2A_agent" etc.
const routeToNode: Record<string, string> = {};
for (const name of sectionNames) {
    routeToNode[name] = `${name}_agent`;
}
routeToNode["room"] = "roomAgent";
routeToNode["__end__"] = END;

const graph = new StateGraph(Telegramagentstate);

// ── Supervisor ──────────────────────────────────────
graph.addNode("supervisor", async (state) => {
    const last = state.messages[state.messages.length - 1];
    const text = (last?.content as string) || "";

    let target = "__end__";
    if (/\/room|available room|free room|empty room/i.test(text)) {
        target = "room";
    } else if (/sem2_a|sem2a/i.test(text)) { target = "Sem2A"; }
    else if (/sem2_b|sem2b/i.test(text)) { target = "Sem2B"; }
    else if (/sem2_c|sem2c/i.test(text)) { target = "Sem2C"; }
    else if (/sem2_d|sem2d/i.test(text)) { target = "Sem2D"; }
    else if (/sem2_e|sem2e/i.test(text)) { target = "Sem2E"; }
    else if (/sem4_a|sem4a/i.test(text)) { target = "Sem4A"; }
    else if (/sem4_b|sem4b/i.test(text)) { target = "Sem4B"; }
    else if (/sem4_c|sem4c/i.test(text)) { target = "Sem4C"; }
    else if (/sem4_d|sem4d/i.test(text)) { target = "Sem4D"; }
    else if (/sem6_ct|sem6ct/i.test(text)) { target = "Sem6CT"; }
    else if (/sem6_a_cs|sem6acs/i.test(text)) { target = "Sem6A_CS"; }
    else if (/sem6_b_cs|sem6bcs/i.test(text)) { target = "Sem6B_CS"; }
    else if (/sem6_c_cs|sem6ccs/i.test(text)) { target = "Sem6C_CS"; }
    else if (/sem6_d_cs|sem6dcs/i.test(text)) { target = "Sem6D_CS"; }
    else if (/sem8_se|sem8se/i.test(text)) { target = "Sem8SE"; }
    else if (/sem8_ke|sem8ke/i.test(text)) { target = "Sem8KE"; }
    else if (/sem8_hpc|sem8hpc/i.test(text)) { target = "Sem8HPC"; }
    else if (/sem8_es|sem8es/i.test(text)) { target = "Sem8ES"; }
    else if (/sem8_ccn|sem8ccn/i.test(text)) { target = "Sem8CCN"; }
    else if (/sem8_bis|sem8bis/i.test(text)) { target = "Sem8BIS"; }

    return { nextAgent: target };
});

// ── Section agents ──────────────────────────────────
function makeSectionAgent(section: string) {
    return async (state: typeof Telegramagentstate.State) => {
        const data = readSection(section);
        if (!data) {
            return { messages: [new HumanMessage(`No timetable data for ${section}.`)] };
        }

        const last = state.messages[state.messages.length - 1];
        const text = (last?.content as string) || "";
        const cmdMatch = text.match(/\/(sem[26]_[a-z_]+)/i);
        const query = cmdMatch ? text.replace(cmdMatch[0], "").trim() : "";

        const timeMsg = state.messages.find((m: any) => m._getType() === "system");

        try {
            const response = await submodel.invoke([
                ...(timeMsg ? [timeMsg] : []),
                new SystemMessage(`You are the timetable assistant for ${section}.

Timetable data for ${section}:
${data}

If the user just sent a bare command, find their NEXT class based on the current time.
If they asked for "all" or "schedule", show everything.
If they specified a day, show only that day.
Otherwise answer their question directly.

Keep it short. No emojis.`),
                new HumanMessage(query || "Show my next class")
            ]);
            return { messages: [response] };
        } catch {
            return { messages: [new HumanMessage(`Failed to query ${section}.`)] };
        }
    };
}

for (const name of sectionNames) {
    graph.addNode(`${name}_agent`, makeSectionAgent(name));
}

// ── Room agent ──────────────────────────────────────
graph.addNode("roomAgent", async (state) => {
    const data = readRooms();
    const timeMsg = state.messages.find((m: any) => m._getType() === "system");

    try {
        const response = await submodel.invoke([
            ...(timeMsg ? [timeMsg] : []),
            new SystemMessage(`You are the room assistant.

Available rooms:
${data || "No room data."}

List the rooms. If the user searches for a specific room, filter for it.
Keep it short. No emojis.`),
            new HumanMessage("Show available rooms")
        ]);
        return { messages: [response] };
    } catch {
        return { messages: [new HumanMessage("Failed to query rooms.")] };
    }
});

// ── Edges ───────────────────────────────────────────
graph.addEdge(START, "supervisor" as any);
graph.addConditionalEdges("supervisor" as any, (s) => routeToNode[s.nextAgent] || END, routeToNode as any);

for (const name of sectionNames) {
    graph.addEdge(`${name}_agent` as any, END);
}
graph.addEdge("roomAgent" as any, END);

const TelegramTimetableagent = graph.compile();
export default TelegramTimetableagent;
