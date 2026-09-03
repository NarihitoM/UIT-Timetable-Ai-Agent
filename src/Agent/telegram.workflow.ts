import { START, END, StateGraph } from "@langchain/langgraph";
import Telegramagentstate from "./telegram.state.ts";
import { HumanMessage, SystemMessage, BaseMessage, AIMessage } from "@langchain/core/messages";
import { submodel } from "./telegram.model.ts";
import { getSectionAgentPrompt, getRoomAgentPrompt, getTimeContextPrompt } from "../prompt/systemprompt.ts";
import * as fs from "fs";
import * as path from "path";
import { FILE_NAMES, DATA_DIR, SECTIONS, sectionMatchPattern, MODEL_RETRY_ATTEMPTS, MODEL_RETRY_BASE_MS } from "../constants.ts";

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

// Earlier turns loaded from the database, without the message being answered right now
function priorTurns(messages: BaseMessage[]): BaseMessage[] {
    return messages.filter(m => !(m instanceof SystemMessage)).slice(0, -1);
}

const CONNECTION_ERROR_CODES = ["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "EPIPE"];

// A dead socket or unresolvable host will not heal within a webhook's lifetime, so
// retrying it only burns the time we have left. Rate limits and 5xx are worth another go.
export function isConnectionError(err: unknown): boolean {
    const code = (err as { code?: string })?.code;
    if (code && CONNECTION_ERROR_CODES.includes(code)) return true;

    const message = (err as { message?: string })?.message?.toLowerCase() ?? "";
    return message.includes("fetch failed") || message.includes("network");
}

export async function invokeWithRetry(
    messages: BaseMessage[],
    attempts = MODEL_RETRY_ATTEMPTS
): Promise<AIMessage> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await submodel.invoke(messages) as AIMessage;
        } catch (err) {
            lastError = err;

            if (isConnectionError(err)) {
                console.error("[retry] connection error, not retrying:", err);
                throw err;
            }

            if (attempt < attempts) {
                const backoff = MODEL_RETRY_BASE_MS * attempt;
                console.error(`[retry] attempt ${attempt}/${attempts} failed, retrying in ${backoff}ms:`, err);
                await new Promise(r => setTimeout(r, backoff));
            }
        }
    }

    throw lastError;
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
    } else {
        const hit = SECTIONS.find(s => sectionMatchPattern(s).test(text));
        if (hit) target = hit.key;
    }

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
            return { messages: [new AIMessage(`No timetable data found for ${section}.`)] };
        }

        // Get the last HumanMessage for the user's query
        const humanMsgs = state.messages.filter((m): m is HumanMessage => m instanceof HumanMessage);
        const last = humanMsgs[humanMsgs.length - 1];
        const text = (last?.content as string) || "";

        // Strip the command prefix to get any extra query the user typed
        const cmdMatch = text.match(/\/\w+/);
        const query = cmdMatch ? text.replace(cmdMatch[0], "").trim() : text.trim();

        // Use instanceof check instead of _getType() — safe across all LangChain versions
        const timeMsg = findSystemMessage(state.messages)
            ?? new SystemMessage(getTimeContextPrompt(new Date()));

        console.log(`[${section}_agent] Query: "${query || "Show my next class"}"`);
        console.log(`[${section}_agent] Time context:`, timeMsg?.content);

        try {
            const response = await invokeWithRetry([
                ...(timeMsg ? [timeMsg] : []),
                new SystemMessage(getSectionAgentPrompt(section, data)),
                ...priorTurns(state.messages),
                new HumanMessage(query || "Show my next class")
            ]);

            console.log(`[${section}_agent] Got response, length:`, (response.content as string)?.length);
            return { messages: [response] };
        } catch (err) {
            console.error(`[${section}_agent] submodel.invoke failed:`, err);
            return { messages: [new AIMessage(`Failed to query timetable for ${section}. Please try again.`)] };
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
        return { messages: [new AIMessage("No room data available.")] };
    }

    const timeMsg = findSystemMessage(state.messages);

    console.log("[roomAgent] Time context:", timeMsg?.content);

    try {
        const response = await invokeWithRetry([
            ...(timeMsg ? [timeMsg] : []),
            new SystemMessage(getRoomAgentPrompt(data)),
            ...priorTurns(state.messages),
            new HumanMessage("Show available rooms")
        ]);

        console.log("[roomAgent] Got response, length:", (response.content as string)?.length);
        return { messages: [response] };
    } catch (err) {
        console.error("[roomAgent] submodel.invoke failed:", err);
        return { messages: [new AIMessage("Failed to query available rooms. Please try again.")] };
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

export function extractFinalAnswer(result: { messages: BaseMessage[] }): string {
    const last = result.messages.at(-1);
    // If nothing ever ran (e.g. routing fell through to "__end__"), the only
    // message left is the original HumanMessage — don't echo it back as an answer.
    if (!last || last instanceof HumanMessage) {
        return "Sorry, I couldn't process that request.";
    }
    return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
}