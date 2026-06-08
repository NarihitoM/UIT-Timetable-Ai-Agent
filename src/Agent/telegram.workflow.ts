import { START, END, StateGraph } from "@langchain/langgraph"
import Telegramagentstate from "./telegram.state.ts"
import { SystemMessage } from "@langchain/core/messages";
import { Supervisorprompt } from "../prompt/systemprompt.ts";
import model from "./telegram.model.ts";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { readSectionATool } from "../Tools/SectionAtool.ts";
import { readSectionBTool } from "../Tools/SectionBtool.ts";
import { readSectionCTool } from "../Tools/SectionCtool.ts";
import { readSectionDTool } from "../Tools/SectionDtool.ts";

const TelegramAgent = new StateGraph(Telegramagentstate);

//Supervisor
TelegramAgent.addNode("Main Agent", async (state) => {
    const history = state.messages || [];

    const prompt = [
        new SystemMessage(Supervisorprompt),
        ...history
    ];

    const response = await model.invoke(prompt);
    const aireply = response.content as string;

    if (aireply.includes("ROUTE:")) {
        let targetAgent = "Main Agent";

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
    const SectionAAgent = model.bindTools([readSectionATool]);
    const response = await SectionAAgent.invoke([...state.messages]);
    return {
        messages: [response]
    };
})

TelegramAgent.addConditionalEdges(
    "Section A" as any,
    toolsCondition as any,
    {
        true: "Section A Tools",
        false: "Main Agent"
    } as any
);

TelegramAgent.addNode("Section A Tools", new ToolNode([readSectionATool]));


//Section B Agent 
TelegramAgent.addNode("Section B", async (state) => {
    const SectionBAgent = model.bindTools([readSectionBTool]);
    const response = await SectionBAgent.invoke([...state.messages]);
    return {
        messages: [response]
    };
})

TelegramAgent.addConditionalEdges(
    "Section B" as any,
    toolsCondition as any,
    {
        true: "Section B Tools",
        false: "Main Agent"
    } as any
);

TelegramAgent.addNode("Section B Tools", new ToolNode([readSectionBTool]));

//Section C Agent
TelegramAgent.addNode("Section C", async (state) => {
    const SectionCAgent = model.bindTools([readSectionCTool]);
    const response = await SectionCAgent.invoke([...state.messages]);
    return {
        messages: [response]
    };
});

TelegramAgent.addConditionalEdges(
    "Section C" as any,
    toolsCondition as any,
    {
        true: "Section C Tools",
        false: "Main Agent"
    } as any
);

TelegramAgent.addNode("Section C Tools", new ToolNode([readSectionCTool]));

//Section D Agent
TelegramAgent.addNode("Section D", async (state) => {
    const SectionDAgent = model.bindTools([readSectionDTool]);
    const response = await SectionDAgent.invoke([...state.messages]);
    return {
        messages: [response]
    };
});

TelegramAgent.addConditionalEdges(
    "Section D" as any,
    toolsCondition as any,
    {
        true: "Section D Tools",
        false: "Main Agent"
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
        "Main Agent": "Main Agent",
        "__end__": END
    } as any
);

TelegramAgent.addEdge("Section A Tools" as any, "Section A" as any);
TelegramAgent.addEdge("Section B Tools" as any, "Section B" as any);
TelegramAgent.addEdge("Section C Tools" as any, "Section C" as any);
TelegramAgent.addEdge("Section D Tools" as any, "Section D" as any);

const TelegramTimetableagent = TelegramAgent.compile();

export default TelegramTimetableagent;