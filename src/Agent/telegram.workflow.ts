import { START, END, StateGraph } from "@langchain/langgraph";
import Telegramagentstate from "./telegram.state.ts";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { submodel } from "./telegram.model.ts";
import { getSubAgentPrompt, getRoomAgentPrompt } from "../prompt/systemprompt.ts";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.resolve(process.cwd(), "src", "data");

const FILE_NAMES: Record<string, string> = {
    "Sem2A": "Sem2A.txt", "Sem2B": "Sem2B.txt", "Sem2C": "Sem2C.txt", "Sem2D": "Sem2D.txt", "Sem2E": "Sem2E.txt",
    "Sem4A": "Sem4A.txt", "Sem4B": "Sem4B.txt", "Sem4C": "Sem4C.txt", "Sem4D": "Sem4D.txt",
    "Sem6CT": "Sem6_CT.txt",
    "Sem6A_CS": "Sem6A_CS.txt", "Sem6B_CS": "Sem6B_CS.txt", "Sem6C_CS": "Sem6C_CS.txt", "Sem6D_CS": "Sem6D_CS.txt",
    "Sem8SE": "Sem8_SE.txt", "Sem8KE": "Sem8_KE.txt", "Sem8HPC": "Sem8_HPC.txt",
    "Sem8ES": "Sem8_ES.txt", "Sem8CCN": "Sem8_CCN.txt", "Sem8BIS": "Sem8_BIS.txt",
};

function readFile(sectionName: string): string | null {
    const fileName = FILE_NAMES[sectionName];
    if (!fileName) return null;
    try {
        return fs.readFileSync(path.join(DATA_DIR, fileName), "utf-8");
    } catch {
        return null;
    }
}

const sectionRoute = (next: string) => "sectionAgent";

const AgentGraph = new StateGraph(Telegramagentstate);

// ── Router node ──────────────────────────────────────────────
AgentGraph.addNode("router", async (state) => {
    const lastMsg = state.messages[state.messages.length - 1];
    const text = (lastMsg?.content as string) || "";

    let target = "__end__";
    if (/\/room|available room|free room|empty room/i.test(text)) {
        target = "roomAgent";
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

    console.log("Router →", target);
    return { nextAgent: target };
});

// ── Section agent node ───────────────────────────────────────
AgentGraph.addNode("sectionAgent", async (state) => {
    const sectionName = state.nextAgent;
    const lastMsg = state.messages[state.messages.length - 1];
    const text = (lastMsg?.content as string) || "";

    const cmdMatch = text.match(/\/(sem[26]_[a-z_]+)/i);
    const userQuery = cmdMatch ? text.replace(cmdMatch[0], "").trim() : text;

    const fileContent = readFile(sectionName);
    if (!fileContent) {
        return { messages: [new HumanMessage(`DATA_ERROR: Could not load timetable for ${sectionName}.`)] };
    }

    const prompt = `${getSubAgentPrompt(sectionName)}\n\nTimetable data:\n${fileContent}`;

    try {
        const llmPromise = submodel.invoke([
            new SystemMessage(prompt),
            new HumanMessage(userQuery || "Show my next class")
        ]);
        const timeoutPromise = new Promise<{ content: string }>((_, reject) =>
            setTimeout(() => reject(new Error("LLM timeout")), 25000)
        );
        const response = await Promise.race([llmPromise, timeoutPromise]) as any;
        return { messages: [response] };
    } catch (e) {
        console.error(`${sectionName} agent error:`, e);
        return { messages: [new HumanMessage(`DATA_ERROR: Failed to process query for ${sectionName}.`)] };
    }
});

// ── Room agent node ──────────────────────────────────────────
AgentGraph.addNode("roomAgent", async (state) => {
    let allData = "";
    for (const [name, file] of Object.entries(FILE_NAMES)) {
        try {
            const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
            allData += `=== ${name} ===\n${content}\n\n`;
        } catch { /* skip */ }
    }

    try {
        const prompt = `${getRoomAgentPrompt()}\n\nAll timetable data:\n${allData}`;
        const llmPromise = submodel.invoke([
            new SystemMessage(prompt),
            new HumanMessage("")
        ]);
        const timeoutPromise = new Promise<{ content: string }>((_, reject) =>
            setTimeout(() => reject(new Error("LLM timeout")), 25000)
        );
        const response = await Promise.race([llmPromise, timeoutPromise]) as any;
        return { messages: [response] };
    } catch (e) {
        console.error("Room agent error:", e);
        return { messages: [new HumanMessage("DATA_ERROR: Failed to process room query.")] };
    }
});

// ── Edges ────────────────────────────────────────────────────
AgentGraph.addEdge(START, "router" as any);

AgentGraph.addConditionalEdges(
    "router" as any,
    (state) => state.nextAgent,
    {
        "Sem2A": "sectionAgent", "Sem2B": "sectionAgent", "Sem2C": "sectionAgent",
        "Sem2D": "sectionAgent", "Sem2E": "sectionAgent",
        "Sem4A": "sectionAgent", "Sem4B": "sectionAgent", "Sem4C": "sectionAgent", "Sem4D": "sectionAgent",
        "Sem6CT": "sectionAgent", "Sem6A_CS": "sectionAgent", "Sem6B_CS": "sectionAgent",
        "Sem6C_CS": "sectionAgent", "Sem6D_CS": "sectionAgent",
        "Sem8SE": "sectionAgent", "Sem8KE": "sectionAgent", "Sem8HPC": "sectionAgent",
        "Sem8ES": "sectionAgent", "Sem8CCN": "sectionAgent", "Sem8BIS": "sectionAgent",
        "roomAgent": "roomAgent",
        "__end__": END
    } as any
);

AgentGraph.addEdge("sectionAgent" as any, END);
AgentGraph.addEdge("roomAgent" as any, END);

const TelegramTimetableagent = AgentGraph.compile();

export default TelegramTimetableagent;
