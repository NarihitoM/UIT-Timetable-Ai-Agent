import { createDeepAgent } from "deepagents";
import { submodel, mainmodel } from "./telegram.model.ts";
import { getSupervisorPrompt, getSectionSubAgentPrompt, getRoomSubAgentPrompt } from "../prompt/systemprompt.ts";
import { readTimetableTool } from "../Tools/readTimetable.ts";
import { readRoomDataTool } from "../Tools/readRoomData.ts";
import { FILE_NAMES } from "../constants.ts";

// ── Sub-agents ────────────────────────────────────────
const sectionSubAgents = Object.entries(FILE_NAMES).map(([name]) => ({
    name: `${name}Agent`,
    description: `Timetable assistant for ${name}`,
    systemPrompt: getSectionSubAgentPrompt(name),
    model: submodel,
    tools: [readTimetableTool]
}));

const roomSubAgent = {
    name: "RoomAgent",
    description: "Room availability assistant",
    systemPrompt: getRoomSubAgentPrompt(),
    model: submodel,
    tools: [readRoomDataTool]
};

// ── Supervisor ────────────────────────────────────────
const agent = createDeepAgent({
    model: mainmodel,
    subagents: [...sectionSubAgents, roomSubAgent],
    systemPrompt: getSupervisorPrompt()
});

export default agent;
