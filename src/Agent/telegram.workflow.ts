import { START, END, StateGraph } from "@langchain/langgraph"
import Telegramagentstate from "./telegram.state.ts"
import { SystemMessage } from "@langchain/core/messages";
import { getRoomAgentPrompt, getSubAgentPrompt, getSupervisorPrompt, getFormatterPrompt } from "../prompt/systemprompt.ts";
import { mainmodel, submodel } from "./telegram.model.ts";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { readSectionATool } from "../Tools/SectionAtool.ts";
import { readSectionBTool } from "../Tools/SectionBtool.ts";
import { readSectionCTool } from "../Tools/SectionCtool.ts";
import { readSectionDTool } from "../Tools/SectionDtool.ts";
import { findFreeRoomsTool } from "../Tools/FreeRoomFind.ts";

const TelegramAgent = new StateGraph(Telegramagentstate);

//Supervisor
TelegramAgent.addNode("Main Agent", async (state) => {
    const history = state.messages || [];
    const lastUserMessage = [...history].reverse().find(m => m._getType() === "human");
    const userText = (lastUserMessage?.content as string) || "";

    if (state.data) {
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

    if (/section_a|section a/i.test(userText)) {
        targetAgent = "Section A";
    } else if (/section_b|section b/i.test(userText)) {
        targetAgent = "Section B";
    } else if (/section_c|section c/i.test(userText)) {
        targetAgent = "Section C";
    } else if (/section_d|section d/i.test(userText)) {
        targetAgent = "Section D";
    } else if (/\/room|available room|free room|empty room/i.test(userText)) {
        targetAgent = "Room Agent";
    }

    return {
        nextAgent: targetAgent,
        messages: [response]
    };
});

//Freeroom Agent
TelegramAgent.addNode("Room Agent", async (state) => {
    const toolAlreadyCalled = state.messages.some(m => (m as any)?.tool_calls?.length > 0);

    if (toolAlreadyCalled) {
        const lastMsg = state.messages[state.messages.length - 1];
        return { messages: [lastMsg], data: true };
    }

    const RoomAgent = submodel.bindTools([findFreeRoomsTool]);
    const response = await RoomAgent.invoke([
        new SystemMessage(`${getRoomAgentPrompt()} Use 'find_free_rooms' tool to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
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

const makeSectionNode = (sectionName: string, tool: any, toolName: string) => {
    return async (state: typeof Telegramagentstate.State) => {
        const toolAlreadyCalled = state.messages.some(m => (m as any)?.tool_calls?.length > 0);

        if (toolAlreadyCalled) {
            const lastMsg = state.messages[state.messages.length - 1];
            return { messages: [lastMsg], data: true };
        }

        const agent = submodel.bindTools([tool]);
        const response = await agent.invoke([
            new SystemMessage(`${getSubAgentPrompt(sectionName)} Use '${toolName}' tool to read the file`),
            ...state.messages]);

        return {
            messages: [response],
            data: !response.tool_calls || response.tool_calls.length === 0
        };
    };
};

TelegramAgent.addNode("Section A", makeSectionNode("Section A", readSectionATool, "read_section_a_file"));
TelegramAgent.addNode("Section B", makeSectionNode("Section B", readSectionBTool, "read_section_b_file"));
TelegramAgent.addNode("Section C", makeSectionNode("Section C", readSectionCTool, "read_section_c_file"));
TelegramAgent.addNode("Section D", makeSectionNode("Section D", readSectionDTool, "read_section_d_file"));

TelegramAgent.addConditionalEdges("Section A" as any, toolsCondition as any, { tools: "Section A Tools", __end__: "Main Agent" } as any);
TelegramAgent.addConditionalEdges("Section B" as any, toolsCondition as any, { tools: "Section B Tools", __end__: "Main Agent" } as any);
TelegramAgent.addConditionalEdges("Section C" as any, toolsCondition as any, { tools: "Section C Tools", __end__: "Main Agent" } as any);
TelegramAgent.addConditionalEdges("Section D" as any, toolsCondition as any, { tools: "Section D Tools", __end__: "Main Agent" } as any);

TelegramAgent.addNode("Section A Tools", new ToolNode([readSectionATool]));
TelegramAgent.addNode("Section B Tools", new ToolNode([readSectionBTool]));
TelegramAgent.addNode("Section C Tools", new ToolNode([readSectionCTool]));
TelegramAgent.addNode("Section D Tools", new ToolNode([readSectionDTool]));

//Main Entry Point
TelegramAgent.addEdge(START, "Main Agent" as any);

TelegramAgent.addConditionalEdges(
    "Main Agent" as any,
    (state) => state.nextAgent,
    {
        "Section A": "Section A",
        "Section B": "Section B",
        "Section C": "Section C",
        "Section D": "Section D",
        "Room Agent" : "Room Agent",
        "__end__": END
    } as any
);

TelegramAgent.addEdge("Section A Tools" as any, "Section A" as any);
TelegramAgent.addEdge("Section B Tools" as any, "Section B" as any);
TelegramAgent.addEdge("Section C Tools" as any, "Section C" as any);
TelegramAgent.addEdge("Section D Tools" as any, "Section D" as any);
TelegramAgent.addEdge("Room Agent tool" as any, "Room Agent" as any);

const TelegramTimetableagent = TelegramAgent.compile();

export default TelegramTimetableagent;