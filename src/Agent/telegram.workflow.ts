import { START, END, StateGraph } from "@langchain/langgraph"
import Telegramagentstate from "./telegram.state.ts"
import { SystemMessage } from "@langchain/core/messages";
import { getRoomAgentPrompt, getSubAgentPrompt, getSupervisorPrompt, getFormatterPrompt } from "../prompt/systemprompt.ts";
import { mainmodel, submodel } from "./telegram.model.ts";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { readSem2ATool } from "../Tools/Sem2Atool.ts";
import { readSem2BTool } from "../Tools/Sem2Btool.ts";
import { readSem2CTool } from "../Tools/Sem2Ctool.ts";
import { readSem2DTool } from "../Tools/Sem2Dtool.ts";
import { readSem2ETool } from "../Tools/Sem2Etool.ts";
import { readSem4ATool } from "../Tools/Sem4Atool.ts";
import { readSem4BTool } from "../Tools/Sem4Btool.ts";
import { readSem4CTool } from "../Tools/Sem4Ctool.ts";
import { readSem4DTool } from "../Tools/Sem4Dtool.ts";
import { readSem6CTTool } from "../Tools/Sem6CTtool.ts";
import { readSem6C_CSTool } from "../Tools/Sem6C_CStool.ts";
import { readSem6D_CSTool } from "../Tools/Sem6D_CStool.ts";
import { readSem6A_CSTool } from "../Tools/Sem6A_CStool.ts";
import { readSem6B_CSTool } from "../Tools/Sem6B_CStool.ts";
import { readSem8SETool } from "../Tools/Sem8SEtool.ts";
import { readSem8KETool } from "../Tools/Sem8KEtool.ts";
import { readSem8HPCTool } from "../Tools/Sem8HPCtool.ts";
import { readSem8ESTool } from "../Tools/Sem8EStool.ts";
import { readSem8CCNTool } from "../Tools/Sem8CCNtool.ts";
import { readSem8BISTool } from "../Tools/Sem8BIStool.ts";
import { findFreeRoomsTool } from "../Tools/FreeRoomFind.ts";

const TelegramAgent = new StateGraph(Telegramagentstate);

//Supervisor
TelegramAgent.addNode("Main Agent", async (state) => {
    try {
        const history = state.messages || [];
        const lastUserMessage = [...history].reverse().find(m => m._getType() === "human");
        const userText = (lastUserMessage?.content as string) || "";

        console.log("Main Agent - userText:", userText);
        console.log("Main Agent - data:", state.data);
        console.log("Main Agent - nextAgent:", state.nextAgent);

        if (state.data) {
            console.log("Main Agent - formatting response");
            let response;
            try {
                const prompt = [
                    new SystemMessage(getFormatterPrompt()),
                    ...state.messages
                ];
                response = await mainmodel.invoke(prompt);
            } catch (e) {
                console.error("Formatter error:", e);
                response = { role: "assistant", content: "Failed to format timetable data." };
            }

            return {
                nextAgent: "__end__",
                messages: [response],
                data: false,
            };
        }

        let targetAgent = "__end__";

        if (/sem2_a|sem2a/i.test(userText)) {
            targetAgent = "Sem2A";
        } else if (/sem2_b|sem2b/i.test(userText)) {
            targetAgent = "Sem2B";
        } else if (/sem2_c|sem2c/i.test(userText)) {
            targetAgent = "Sem2C";
        } else if (/sem2_d|sem2d/i.test(userText)) {
            targetAgent = "Sem2D";
        } else if (/sem2_e|sem2e/i.test(userText)) {
            targetAgent = "Sem2E";
        } else if (/section_a|section a|sem4_a|sem4a/i.test(userText)) {
            targetAgent = "Sem4A";
        } else if (/section_b|section b|sem4_b|sem4b/i.test(userText)) {
            targetAgent = "Sem4B";
        } else if (/section_c|section c|sem4_c|sem4c/i.test(userText)) {
            targetAgent = "Sem4C";
        } else if (/section_d|section d|sem4_d|sem4d/i.test(userText)) {
            targetAgent = "Sem4D";
        } else if (/sem6_ct|sem6ct/i.test(userText)) {
            targetAgent = "Sem6CT";
        } else if (/sem6_c_cs|sem6c_cs|sem6ccs/i.test(userText)) {
            targetAgent = "Sem6C_CS";
        } else if (/sem6_d_cs|sem6d_cs|sem6dcs/i.test(userText)) {
            targetAgent = "Sem6D_CS";
        } else if (/sem6_a_cs|sem6a_cs|sem6acs/i.test(userText)) {
            targetAgent = "Sem6A_CS";
        } else if (/sem6_b_cs|sem6b_cs|sem6bcs/i.test(userText)) {
            targetAgent = "Sem6B_CS";
        } else if (/sem8_se|sem8se/i.test(userText)) {
            targetAgent = "Sem8SE";
        } else if (/sem8_ke|sem8ke/i.test(userText)) {
            targetAgent = "Sem8KE";
        } else if (/sem8_hpc|sem8hpc/i.test(userText)) {
            targetAgent = "Sem8HPC";
        } else if (/sem8_es|sem8es/i.test(userText)) {
            targetAgent = "Sem8ES";
        } else if (/sem8_ccn|sem8ccn/i.test(userText)) {
            targetAgent = "Sem8CCN";
        } else if (/sem8_bis|sem8bis/i.test(userText)) {
            targetAgent = "Sem8BIS";
        } else if (/\/room|available room|free room|empty room/i.test(userText)) {
            targetAgent = "Room Agent";
        }

        console.log("Main Agent - routed to:", targetAgent);

        // Try LLM for supervisor context, but routing is already decided by regex
        let response;
        try {
            const prompt = [
                new SystemMessage(getSupervisorPrompt()),
                ...history
            ];
            response = await mainmodel.invoke(prompt);
        } catch {
            response = { content: `ROUTE: ${targetAgent}` };
        }

        return {
            nextAgent: targetAgent,
            messages: [response]
        };
    } catch (error) {
        console.error("Main Agent error:", error);
        // Don't throw — route to END gracefully
        return {
            nextAgent: "__end__",
            messages: [{ role: "assistant", content: "Supervisor error occurred." }]
        };
    }
});

//Helper: wraps a sub-agent with error handling + tool-loop guard
const makeSubAgentNode = (model: any, tool: any, toolName: string, prompt: string, getPrompt: (s: string) => string) =>
    async (state: typeof Telegramagentstate.State) => {
        try {
            const toolAlreadyCalled = state.messages.some(m => (m as any)?.tool_calls?.length > 0);
            if (toolAlreadyCalled) {
                return { messages: [state.messages[state.messages.length - 1]], data: true };
            }
            const agent = model.bindTools([tool], { tool_choice: "auto" });
            const response = await agent.invoke([
                new SystemMessage(`${getPrompt(prompt)} Use '${toolName}' tool to read the file`),
                ...state.messages
            ]);
            return { messages: [response], data: !response.tool_calls || response.tool_calls.length === 0 };
        } catch (error) {
            console.error(`${prompt} Agent error:`, error);
            return {
                messages: [{ role: "assistant", content: `DATA_ERROR: ${prompt} agent encountered an error. Please try again.` }],
                data: true
            };
        }
    };

//Freeroom Agent
TelegramAgent.addNode("Room Agent", makeSubAgentNode(mainmodel, findFreeRoomsTool, "find_free_rooms", "Room", getRoomAgentPrompt));
TelegramAgent.addConditionalEdges("Room Agent" as any, toolsCondition as any, { tools: "Room Agent tool", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Room Agent tool", new ToolNode([findFreeRoomsTool]));

//Section Agents
interface SectionDef { node: string; file: string; tool: any; }
const sections: SectionDef[] = [
    { node: "Sem4A", file: "read_sem4_a_file", tool: readSem4ATool },
    { node: "Sem4B", file: "read_sem4_b_file", tool: readSem4BTool },
    { node: "Sem4C", file: "read_sem4_c_file", tool: readSem4CTool },
    { node: "Sem4D", file: "read_sem4_d_file", tool: readSem4DTool },
    { node: "Sem2A", file: "read_sem2_a_file", tool: readSem2ATool },
    { node: "Sem2B", file: "read_sem2_b_file", tool: readSem2BTool },
    { node: "Sem2C", file: "read_sem2_c_file", tool: readSem2CTool },
    { node: "Sem2D", file: "read_sem2_d_file", tool: readSem2DTool },
    { node: "Sem2E", file: "read_sem2_e_file", tool: readSem2ETool },
    { node: "Sem6CT", file: "read_sem6_ct_file", tool: readSem6CTTool },
    { node: "Sem6C_CS", file: "read_sem6_c_cs_file", tool: readSem6C_CSTool },
    { node: "Sem6D_CS", file: "read_sem6_d_cs_file", tool: readSem6D_CSTool },
    { node: "Sem6A_CS", file: "read_sem6_a_cs_file", tool: readSem6A_CSTool },
    { node: "Sem6B_CS", file: "read_sem6_b_cs_file", tool: readSem6B_CSTool },
    { node: "Sem8SE", file: "read_sem8_se_file", tool: readSem8SETool },
    { node: "Sem8KE", file: "read_sem8_ke_file", tool: readSem8KETool },
    { node: "Sem8HPC", file: "read_sem8_hpc_file", tool: readSem8HPCTool },
    { node: "Sem8ES", file: "read_sem8_es_file", tool: readSem8ESTool },
    { node: "Sem8CCN", file: "read_sem8_ccn_file", tool: readSem8CCNTool },
    { node: "Sem8BIS", file: "read_sem8_bis_file", tool: readSem8BISTool },
];

for (const s of sections) {
    TelegramAgent.addNode(s.node, makeSubAgentNode(submodel, s.tool, s.file, s.node, getSubAgentPrompt));
    TelegramAgent.addConditionalEdges(s.node as any, toolsCondition as any, {
        tools: `${s.node} Tools`,
        __end__: "Main Agent"
    } as any);
    TelegramAgent.addNode(`${s.node} Tools`, new ToolNode([s.tool]));
}

//Main Entry Point
TelegramAgent.addEdge(START, "Main Agent" as any);

TelegramAgent.addConditionalEdges(
    "Main Agent" as any,
    (state) => state.nextAgent,
    {
        "Sem2A": "Sem2A",
        "Sem2B": "Sem2B",
        "Sem2C": "Sem2C",
        "Sem2D": "Sem2D",
        "Sem2E": "Sem2E",
        "Sem4A": "Sem4A",
        "Sem4B": "Sem4B",
        "Sem4C": "Sem4C",
        "Sem4D": "Sem4D",
        "Sem6CT": "Sem6CT",
        "Sem6C_CS": "Sem6C_CS",
        "Sem6D_CS": "Sem6D_CS",
        "Sem6A_CS": "Sem6A_CS",
        "Sem6B_CS": "Sem6B_CS",
        "Sem8SE": "Sem8SE",
        "Sem8KE": "Sem8KE",
        "Sem8HPC": "Sem8HPC",
        "Sem8ES": "Sem8ES",
        "Sem8CCN": "Sem8CCN",
        "Sem8BIS": "Sem8BIS",
        "Room Agent" : "Room Agent",
        "__end__": END
    } as any
);

TelegramAgent.addEdge("Sem2A Tools" as any, "Sem2A" as any);
TelegramAgent.addEdge("Sem2B Tools" as any, "Sem2B" as any);
TelegramAgent.addEdge("Sem2C Tools" as any, "Sem2C" as any);
TelegramAgent.addEdge("Sem2D Tools" as any, "Sem2D" as any);
TelegramAgent.addEdge("Sem2E Tools" as any, "Sem2E" as any);
TelegramAgent.addEdge("Sem4A Tools" as any, "Sem4A" as any);
TelegramAgent.addEdge("Sem4B Tools" as any, "Sem4B" as any);
TelegramAgent.addEdge("Sem4C Tools" as any, "Sem4C" as any);
TelegramAgent.addEdge("Sem4D Tools" as any, "Sem4D" as any);
TelegramAgent.addEdge("Sem6CT Tools" as any, "Sem6CT" as any);
TelegramAgent.addEdge("Sem6C_CS Tools" as any, "Sem6C_CS" as any);
TelegramAgent.addEdge("Sem6D_CS Tools" as any, "Sem6D_CS" as any);
TelegramAgent.addEdge("Sem6A_CS Tools" as any, "Sem6A_CS" as any);
TelegramAgent.addEdge("Sem6B_CS Tools" as any, "Sem6B_CS" as any);
TelegramAgent.addEdge("Sem8SE Tools" as any, "Sem8SE" as any);
TelegramAgent.addEdge("Sem8KE Tools" as any, "Sem8KE" as any);
TelegramAgent.addEdge("Sem8HPC Tools" as any, "Sem8HPC" as any);
TelegramAgent.addEdge("Sem8ES Tools" as any, "Sem8ES" as any);
TelegramAgent.addEdge("Sem8CCN Tools" as any, "Sem8CCN" as any);
TelegramAgent.addEdge("Sem8BIS Tools" as any, "Sem8BIS" as any);
TelegramAgent.addEdge("Room Agent tool" as any, "Room Agent" as any);

const TelegramTimetableagent = TelegramAgent.compile();

export default TelegramTimetableagent;