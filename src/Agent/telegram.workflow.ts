import { START, END, StateGraph } from "@langchain/langgraph";
import Telegramagentstate from "./telegram.state.ts";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { submodel } from "./telegram.model.ts";
import { getSectionAgentPrompt, getRoomAgentPrompt } from "../prompt/systemprompt.ts";
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

// ── Safe way to find the SystemMessage (no _getType() which can crash) ──────
function findSystemMessage(messages: BaseMessage[]): SystemMessage | undefined {
    return messages.find((m): m is SystemMessage => m instanceof SystemMessage);
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

// ── Supervisor ──────────────────────────────────────────────────────────────
graph.addNode("supervisor", async (state) => {
    // Look through all messages for the human text (last HumanMessage)
    const humanMsgs = state.messages.filter((m): m is HumanMessage => m instanceof HumanMessage);
    const last = humanMsgs[humanMsgs.length - 1];
    const text = (last?.content as string) || "";

    console.log("[Supervisor] Routing for text:", text);

    let target = "__end__";
    if (/\/room|available room|free room|empty room/i.test(text)) {
        target = "room";
    } else if (/sem2_a|sem2a/i.test(text))        { target = "Sem2A"; }
    else if (/sem2_b|sem2b/i.test(text))           { target = "Sem2B"; }
    else if (/sem2_c|sem2c/i.test(text))           { target = "Sem2C"; }
    else if (/sem2_d|sem2d/i.test(text))           { target = "Sem2D"; }
    else if (/sem2_e|sem2e/i.test(text))           { target = "Sem2E"; }
    else if (/sem4_a|sem4a/i.test(text))           { target = "Sem4A"; }
    else if (/sem4_b|sem4b/i.test(text))           { target = "Sem4B"; }
    else if (/sem4_c|sem4c/i.test(text))           { target = "Sem4C"; }
    else if (/sem4_d|sem4d/i.test(text))           { target = "Sem4D"; }
    else if (/sem6_ct|sem6ct/i.test(text))         { target = "Sem6CT"; }
    else if (/sem6_a_cs|sem6acs/i.test(text))      { target = "Sem6A_CS"; }
    else if (/sem6_b_cs|sem6bcs/i.test(text))      { target = "Sem6B_CS"; }
    else if (/sem6_c_cs|sem6ccs/i.test(text))      { target = "Sem6C_CS"; }
    else if (/sem6_d_cs|sem6dcs/i.test(text))      { target = "Sem6D_CS"; }
    else if (/sem8_se|sem8se/i.test(text))         { target = "Sem8SE"; }
    else if (/sem8_ke|sem8ke/i.test(text))         { target = "Sem8KE"; }
    else if (/sem8_hpc|sem8hpc/i.test(text))       { target = "Sem8HPC"; }
    else if (/sem8_es|sem8es/i.test(text))         { target = "Sem8ES"; }
    else if (/sem8_ccn|sem8ccn/i.test(text))       { target = "Sem8CCN"; }
    else if (/sem8_bis|sem8bis/i.test(text))       { target = "Sem8BIS"; }

    console.log("[Supervisor] Routing to:", target);
    return { nextAgent: target };
});

// ── Section agents ──────────────────────────────────────────────────────────
function makeSectionAgent(section: string) {
    return async (state: typeof Telegramagentstate.State) => {
        console.log(`[${section}_agent] Starting`);

        const data = readSection(section);
        if (!data) {
            console.error(`[${section}_agent] No data file found`);
            return { messages: [new HumanMessage(`No timetable data found for ${section}.`)] };
        }

        // Get the last HumanMessage for the user's query
        const humanMsgs = state.messages.filter((m): m is HumanMessage => m instanceof HumanMessage);
        const last = humanMsgs[humanMsgs.length - 1];
        const text = (last?.content as string) || "";

        // Strip the command prefix to get any extra query the user typed
        const cmdMatch = text.match(/\/\w+/);
        const query = cmdMatch ? text.replace(cmdMatch[0], "").trim() : text.trim();

        // Use instanceof check instead of _getType() — safe across all LangChain versions
        const timeMsg = findSystemMessage(state.messages);

        console.log(`[${section}_agent] Query: "${query || "Show my next class"}"`);
        console.log(`[${section}_agent] Time context:`, timeMsg?.content);

        try {
            const response = await submodel.invoke([
                ...(timeMsg ? [timeMsg] : []),
                new SystemMessage(getSectionAgentPrompt(section, data)),
                new HumanMessage(query || "Show my next class")
            ]);

            console.log(`[${section}_agent] Got response, length:`, (response.content as string)?.length);
            return { messages: [response] };
        } catch (err) {
            console.error(`[${section}_agent] submodel.invoke failed:`, err);
            return { messages: [new HumanMessage(`Failed to query timetable for ${section}. Please try again.`)] };
        }
    };
}

for (const name of sectionNames) {
    graph.addNode(`${name}_agent`, makeSectionAgent(name));
}

// ── Room agent ──────────────────────────────────────────────────────────────
graph.addNode("roomAgent", async (state) => {
    console.log("[roomAgent] Starting");

    const data = readRooms();
    if (!data) {
        console.error("[roomAgent] No room data file found");
        return { messages: [new HumanMessage("No room data available.")] };
    }

    const timeMsg = findSystemMessage(state.messages);

    console.log("[roomAgent] Time context:", timeMsg?.content);

    try {
        const response = await submodel.invoke([
            ...(timeMsg ? [timeMsg] : []),
            new SystemMessage(getRoomAgentPrompt(data)),
            new HumanMessage("Show available rooms")
        ]);

        console.log("[roomAgent] Got response, length:", (response.content as string)?.length);
        return { messages: [response] };
    } catch (err) {
        console.error("[roomAgent] submodel.invoke failed:", err);
        return { messages: [new HumanMessage("Failed to query available rooms. Please try again.")] };
    }
});

// ── Edges ───────────────────────────────────────────────────────────────────
graph.addEdge(START, "supervisor" as any);
graph.addConditionalEdges("supervisor" as any, (s) => s.nextAgent, routeToNode as any);

for (const name of sectionNames) {
    graph.addEdge(`${name}_agent` as any, END);
}
graph.addEdge("roomAgent" as any, END);

const TelegramTimetableagent = graph.compile();
export default TelegramTimetableagent;