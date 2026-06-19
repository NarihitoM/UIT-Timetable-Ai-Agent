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
            const prompt = [
                new SystemMessage(getFormatterPrompt()),
                ...state.messages
            ];

            const response = await mainmodel.invoke(prompt);

            return {
                nextAgent: "__end__",
                messages: [response],
                data: false,
            };
        }

        const prompt = [
            new SystemMessage(getSupervisorPrompt()),
            ...history
        ];

        const response = await mainmodel.invoke(prompt);
        const aireply = response.content as string;

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

        return {
            nextAgent: targetAgent,
            messages: [response]
        };
    } catch (error) {
        console.error("Main Agent error:", error);
        throw error;
    }
});

//Freeroom Agent
TelegramAgent.addNode("Room Agent", async (state) => {
    try {
        const toolAlreadyCalled = state.messages.some(m => (m as any)?.tool_calls?.length > 0);

        if (toolAlreadyCalled) {
            const lastMsg = state.messages[state.messages.length - 1];
            return { messages: [lastMsg], data: true };
        }

        const RoomAgent = mainmodel.bindTools([findFreeRoomsTool]);
        const response = await RoomAgent.invoke([
            new SystemMessage(`${getRoomAgentPrompt()} Use 'find_free_rooms' tool to read the file`),
            ...state.messages]);

        const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

        return {
            messages: [response],
            data: isFinishedWithTools
        };
    } catch (error) {
        console.error("Room Agent error:", error);
        throw error;
    }
})

TelegramAgent.addConditionalEdges(
    "Room Agent" as any,
    toolsCondition as any,
    {
        tools: "Room Agent tool",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Room Agent tool", new ToolNode([findFreeRoomsTool]));

//Sem4A Agent
TelegramAgent.addNode("Sem4A", async (state) => {
    const Sem4AAgent = submodel.bindTools([readSem4ATool]);
    const response = await Sem4AAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem4A")} Use 'read_sem4_a_file' tool to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
})

TelegramAgent.addConditionalEdges(
    "Sem4A" as any,
    toolsCondition as any,
    {
        tools: "Sem4A Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Sem4A Tools", new ToolNode([readSem4ATool]));


//Sem4B Agent
TelegramAgent.addNode("Sem4B", async (state) => {
    const Sem4BAgent = submodel.bindTools([readSem4BTool]);
    const response = await Sem4BAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem4B")} Use 'read_sem4_b_file' tool to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
})

TelegramAgent.addConditionalEdges(
    "Sem4B" as any,
    toolsCondition as any,
    {
        tools: "Sem4B Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Sem4B Tools", new ToolNode([readSem4BTool]));

//Sem4C Agent
TelegramAgent.addNode("Sem4C", async (state) => {
    const Sem4CAgent = submodel.bindTools([readSem4CTool]);
    const response = await Sem4CAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem4C")} Use 'read_sem4_c_file' tool to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
});

TelegramAgent.addConditionalEdges(
    "Sem4C" as any,
    toolsCondition as any,
    {
        tools: "Sem4C Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Sem4C Tools", new ToolNode([readSem4CTool]));

//Sem4D Agent
TelegramAgent.addNode("Sem4D", async (state) => {
    const Sem4DAgent = submodel.bindTools([readSem4DTool]);
    const response = await Sem4DAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem4D")} Use 'read_sem4_d_file' tool to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
});

TelegramAgent.addConditionalEdges(
    "Sem4D" as any,
    toolsCondition as any,
    {
        tools: "Sem4D Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Sem4D Tools", new ToolNode([readSem4DTool]));

//Sem2A Agent
TelegramAgent.addNode("Sem2A", async (state) => {
    const Sem2AAgent = submodel.bindTools([readSem2ATool]);
    const response = await Sem2AAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem2A")} Use 'read_sem2_a_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem2A" as any, toolsCondition as any, { tools: "Sem2A Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem2A Tools", new ToolNode([readSem2ATool]));

//Sem2B Agent
TelegramAgent.addNode("Sem2B", async (state) => {
    const Sem2BAgent = submodel.bindTools([readSem2BTool]);
    const response = await Sem2BAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem2B")} Use 'read_sem2_b_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem2B" as any, toolsCondition as any, { tools: "Sem2B Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem2B Tools", new ToolNode([readSem2BTool]));

//Sem2C Agent
TelegramAgent.addNode("Sem2C", async (state) => {
    const Sem2CAgent = submodel.bindTools([readSem2CTool]);
    const response = await Sem2CAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem2C")} Use 'read_sem2_c_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem2C" as any, toolsCondition as any, { tools: "Sem2C Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem2C Tools", new ToolNode([readSem2CTool]));

//Sem2D Agent
TelegramAgent.addNode("Sem2D", async (state) => {
    const Sem2DAgent = submodel.bindTools([readSem2DTool]);
    const response = await Sem2DAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem2D")} Use 'read_sem2_d_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem2D" as any, toolsCondition as any, { tools: "Sem2D Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem2D Tools", new ToolNode([readSem2DTool]));

//Sem2E Agent
TelegramAgent.addNode("Sem2E", async (state) => {
    const Sem2EAgent = submodel.bindTools([readSem2ETool]);
    const response = await Sem2EAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem2E")} Use 'read_sem2_e_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem2E" as any, toolsCondition as any, { tools: "Sem2E Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem2E Tools", new ToolNode([readSem2ETool]));

//Sem6CT Agent
TelegramAgent.addNode("Sem6CT", async (state) => {
    const Sem6CTAgent = submodel.bindTools([readSem6CTTool]);
    const response = await Sem6CTAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem6CT")} Use 'read_sem6_ct_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem6CT" as any, toolsCondition as any, { tools: "Sem6CT Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem6CT Tools", new ToolNode([readSem6CTTool]));

//Sem6C_CS Agent
TelegramAgent.addNode("Sem6C_CS", async (state) => {
    const Sem6C_CSAgent = submodel.bindTools([readSem6C_CSTool]);
    const response = await Sem6C_CSAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem6C_CS")} Use 'read_sem6_c_cs_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem6C_CS" as any, toolsCondition as any, { tools: "Sem6C_CS Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem6C_CS Tools", new ToolNode([readSem6C_CSTool]));

//Sem6D_CS Agent
TelegramAgent.addNode("Sem6D_CS", async (state) => {
    const Sem6D_CSAgent = submodel.bindTools([readSem6D_CSTool]);
    const response = await Sem6D_CSAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem6D_CS")} Use 'read_sem6_d_cs_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem6D_CS" as any, toolsCondition as any, { tools: "Sem6D_CS Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem6D_CS Tools", new ToolNode([readSem6D_CSTool]));

//Sem6A_CS Agent
TelegramAgent.addNode("Sem6A_CS", async (state) => {
    const Sem6A_CSAgent = submodel.bindTools([readSem6A_CSTool]);
    const response = await Sem6A_CSAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem6A_CS")} Use 'read_sem6_a_cs_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem6A_CS" as any, toolsCondition as any, { tools: "Sem6A_CS Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem6A_CS Tools", new ToolNode([readSem6A_CSTool]));

//Sem6B_CS Agent
TelegramAgent.addNode("Sem6B_CS", async (state) => {
    const Sem6B_CSAgent = submodel.bindTools([readSem6B_CSTool]);
    const response = await Sem6B_CSAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem6B_CS")} Use 'read_sem6_b_cs_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem6B_CS" as any, toolsCondition as any, { tools: "Sem6B_CS Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem6B_CS Tools", new ToolNode([readSem6B_CSTool]));

//Sem8SE Agent
TelegramAgent.addNode("Sem8SE", async (state) => {
    const Sem8SEAgent = submodel.bindTools([readSem8SETool]);
    const response = await Sem8SEAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem8SE")} Use 'read_sem8_se_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem8SE" as any, toolsCondition as any, { tools: "Sem8SE Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem8SE Tools", new ToolNode([readSem8SETool]));

//Sem8KE Agent
TelegramAgent.addNode("Sem8KE", async (state) => {
    const Sem8KEAgent = submodel.bindTools([readSem8KETool]);
    const response = await Sem8KEAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem8KE")} Use 'read_sem8_ke_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem8KE" as any, toolsCondition as any, { tools: "Sem8KE Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem8KE Tools", new ToolNode([readSem8KETool]));

//Sem8HPC Agent
TelegramAgent.addNode("Sem8HPC", async (state) => {
    const Sem8HPCAgent = submodel.bindTools([readSem8HPCTool]);
    const response = await Sem8HPCAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem8HPC")} Use 'read_sem8_hpc_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem8HPC" as any, toolsCondition as any, { tools: "Sem8HPC Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem8HPC Tools", new ToolNode([readSem8HPCTool]));

//Sem8ES Agent
TelegramAgent.addNode("Sem8ES", async (state) => {
    const Sem8ESAgent = submodel.bindTools([readSem8ESTool]);
    const response = await Sem8ESAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem8ES")} Use 'read_sem8_es_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem8ES" as any, toolsCondition as any, { tools: "Sem8ES Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem8ES Tools", new ToolNode([readSem8ESTool]));

//Sem8CCN Agent
TelegramAgent.addNode("Sem8CCN", async (state) => {
    const Sem8CCNAgent = submodel.bindTools([readSem8CCNTool]);
    const response = await Sem8CCNAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem8CCN")} Use 'read_sem8_ccn_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem8CCN" as any, toolsCondition as any, { tools: "Sem8CCN Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem8CCN Tools", new ToolNode([readSem8CCNTool]));

//Sem8BIS Agent
TelegramAgent.addNode("Sem8BIS", async (state) => {
    const Sem8BISAgent = submodel.bindTools([readSem8BISTool]);
    const response = await Sem8BISAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Sem8BIS")} Use 'read_sem8_bis_file' tool to read the file`),
        ...state.messages]);
    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;
    return { messages: [response], data: isFinishedWithTools };
})
TelegramAgent.addConditionalEdges("Sem8BIS" as any, toolsCondition as any, { tools: "Sem8BIS Tools", __end__: "Main Agent" } as any);
TelegramAgent.addNode("Sem8BIS Tools", new ToolNode([readSem8BISTool]));

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