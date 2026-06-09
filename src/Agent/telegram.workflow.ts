import { START, END, StateGraph } from "@langchain/langgraph"
import Telegramagentstate from "./telegram.state.ts"
import { SystemMessage } from "@langchain/core/messages";
import { getSubAgentPrompt, getSupervisorPrompt } from "../prompt/systemprompt.ts";
import { mainmodel, submodel } from "./telegram.model.ts";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { readSectionATool } from "../Tools/SectionAtool.ts";
import { readSectionBTool } from "../Tools/SectionBtool.ts";
import { readSectionCTool } from "../Tools/SectionCtool.ts";
import { readSectionDTool } from "../Tools/SectionDtool.ts";

const TelegramAgent = new StateGraph(Telegramagentstate);

//Supervisor
TelegramAgent.addNode("Main Agent", async (state) => {
    const history = state.messages || [];

    if (state.data) {
        const prompt = [
            new SystemMessage(getSupervisorPrompt()),
            ...state.messages
        ];
        const response = await mainmodel.invoke(prompt);
        
        if (response.additional_kwargs?.tool_calls) {
            delete response.additional_kwargs.tool_calls;
        }
        if ((response as any).tool_calls) {
            (response as any).tool_calls = [];
        }

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

    if (aireply.includes("ROUTE:")) {
        let targetAgent = "__end__";

        switch (true) {
            case aireply.includes("ROUTE: section_a_agent"):
                targetAgent = "Section A";
                break;
            case aireply.includes("ROUTE: section_b_agent"):
                targetAgent = "Section B";
                break;
            case aireply.includes("ROUTE: section_c_agent"):
                targetAgent = "Section C";
                break;
            case aireply.includes("ROUTE: section_d_agent"):
                targetAgent = "Section D";
                break;
        }

        return {
            nextAgent: targetAgent,
            messages: [response]
        };
    }

    return {
        nextAgent: "__end__",
        messages: [response]
    };
});

//Section A Agent
TelegramAgent.addNode("Section A", async (state) => {
    const SectionAAgent = submodel.bindTools([readSectionATool]);
    const response = await SectionAAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Section A")} Use 'read_section_a_file' to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
})

TelegramAgent.addConditionalEdges(
    "Section A" as any,
    toolsCondition as any,
    {
        tools: "Section A Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Section A Tools", new ToolNode([readSectionATool]));


//Section B Agent
TelegramAgent.addNode("Section B", async (state) => {
    const SectionBAgent = submodel.bindTools([readSectionBTool]);
    const response = await SectionBAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Section B")} Use 'read_section_b_file' to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
})

TelegramAgent.addConditionalEdges(
    "Section B" as any,
    toolsCondition as any,
    {
        tools: "Section B Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Section B Tools", new ToolNode([readSectionBTool]));

//Section C Agent
TelegramAgent.addNode("Section C", async (state) => {
    const SectionCAgent = submodel.bindTools([readSectionCTool]);
    const response = await SectionCAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Section C")} Use 'read_section_c_file' to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
});

TelegramAgent.addConditionalEdges(
    "Section C" as any,
    toolsCondition as any,
    {
        tools: "Section C Tools",
        __end__: "Main Agent"
    } as any
);

TelegramAgent.addNode("Section C Tools", new ToolNode([readSectionCTool]));

//Section D Agent
TelegramAgent.addNode("Section D", async (state) => {
    const SectionDAgent = submodel.bindTools([readSectionDTool]);
    const response = await SectionDAgent.invoke([
        new SystemMessage(`${getSubAgentPrompt("Section D")} Use 'read_section_d_file' to read the file`),
        ...state.messages]);

    const isFinishedWithTools = !response.tool_calls || response.tool_calls.length === 0;

    return {
        messages: [response],
        data: isFinishedWithTools
    };
});

TelegramAgent.addConditionalEdges(
    "Section D" as any,
    toolsCondition as any,
    {
        tools: "Section D Tools",
        __end__: "Main Agent"
    } as any
);

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
        "__end__": END
    } as any
);

TelegramAgent.addEdge("Section A Tools" as any, "Section A" as any);
TelegramAgent.addEdge("Section B Tools" as any, "Section B" as any);
TelegramAgent.addEdge("Section C Tools" as any, "Section C" as any);
TelegramAgent.addEdge("Section D Tools" as any, "Section D" as any);

const TelegramTimetableagent = TelegramAgent.compile();

export default TelegramTimetableagent;