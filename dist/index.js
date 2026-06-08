"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/config/env.ts
var import_dotenv = require("dotenv");
var import_path = __toESM(require("path"));
(0, import_dotenv.configDotenv)({ path: import_path.default.resolve(process.cwd(), ".env") });

// src/index.ts
var import_express2 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));

// src/modules/telegram.route.ts
var import_express = __toESM(require("express"));

// src/modules/telegram.controller.ts
var import_messages2 = require("@langchain/core/messages");

// src/Agent/telegram.workflow.ts
var import_langgraph2 = require("@langchain/langgraph");

// src/Agent/telegram.state.ts
var import_langgraph = require("@langchain/langgraph");
var Telegramagentstate = import_langgraph.Annotation.Root({
  messages: (0, import_langgraph.Annotation)({
    reducer: (x, y) => x.concat(y),
    default: () => []
  }),
  nextAgent: (0, import_langgraph.Annotation)({
    reducer: (x, y) => y ?? x,
    default: () => "main_agent"
  })
});
var telegram_state_default = Telegramagentstate;

// src/Agent/telegram.workflow.ts
var import_messages = require("@langchain/core/messages");

// src/prompt/systemprompt.ts
var Supervisorprompt = `You are a supervisor agent that routes tasks to specialized section agents based on the user's command.

CRITICAL ROUTING RULES:
1. If the user message starts with or asks about "/Section A", your response MUST start with the exact string: "ROUTE: section_a_agent" followed by a clear description of what the user wants them to find.
2. If the user message starts with or asks about "/Section B", your response MUST start with the exact string: "ROUTE: section_b_agent" followed by a clear description of what the user wants them to find.
3. If the user message starts with or asks about "/Section C", your response MUST start with the exact string: "ROUTE: section_c_agent" followed by a clear description of what the user wants them to find.
4. If the user message starts with or asks about "/Section D", your response MUST start with the exact string: "ROUTE: section_d_agent" followed by a clear description of what the user wants them to find.

FINAL ANSWER RULE:
If a specialized agent has already run its tool and you are reading their data findings from the conversation history, do NOT include any "ROUTE:" string. Summarize the timetable data into a clean, final answer for the user instead.

OUTPUT EXAMPLE FOR ROUTING:
ROUTE: section_a_agent The user wants to check the room allocation for class 100 or etc.`;

// src/Agent/telegram.model.ts
var import_groq = require("@langchain/groq");
var model = new import_groq.ChatGroq({
  model: "openai/gpt-oss-120b",
  streaming: true,
  apiKey: process.env.GROQ_API_KEY
});
var telegram_model_default = model;

// src/Agent/telegram.workflow.ts
var import_prebuilt = require("@langchain/langgraph/prebuilt");

// src/Tools/SectionAtool.ts
var import_tools = require("@langchain/core/tools");
var import_zod = require("zod");
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var readSectionATool = (0, import_tools.tool)(
  async (input) => {
    try {
      const filePath = path2.resolve(process.cwd(), "src", "data", "Section A.txt");
      if (!fs.existsSync(filePath)) {
        return `Error: The file "Section A.txt" could not be found in the data/ directory.`;
      }
      const fileContent = fs.readFileSync(filePath, "utf-8");
      if (input.query && input.query.trim() !== "") {
        const lines = fileContent.split("\n");
        const lowerQuery = input.query.toLowerCase();
        const matchedLines = lines.filter((line) => line.toLowerCase().includes(lowerQuery));
        if (matchedLines.length === 0) {
          return `File "Section A.txt" read successfully. No specific matching records found for search term: "${input.query}".`;
        }
        return `File "Section A.txt" read successfully. Filtered matches for "${input.query}":

${matchedLines.join("\n")}`;
      }
      return `Successfully read Section A.txt data contents:

${fileContent}`;
    } catch (error) {
      return `Failed to read Section A.txt. Error details: ${String(error)}`;
    }
  },
  {
    name: "read_section_a_file",
    description: "Use this tool to read, parse, or lookup information inside the Section A timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
    schema: import_zod.z.object({
      query: import_zod.z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Section A.txt.")
    })
  }
);

// src/Tools/SectionBtool.ts
var import_tools2 = require("@langchain/core/tools");
var import_zod2 = require("zod");
var fs2 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var readSectionBTool = (0, import_tools2.tool)(
  async (input) => {
    try {
      const filePath = path3.resolve(process.cwd(), "src", "data", "Section B.txt");
      if (!fs2.existsSync(filePath)) {
        return `Error: The file "Section B.txt" could not be found in the data/ directory.`;
      }
      const fileContent = fs2.readFileSync(filePath, "utf-8");
      if (input.query && input.query.trim() !== "") {
        const lines = fileContent.split("\n");
        const lowerQuery = input.query.toLowerCase();
        const matchedLines = lines.filter((line) => line.toLowerCase().includes(lowerQuery));
        if (matchedLines.length === 0) {
          return `File "Section B.txt" read successfully. No specific matching records found for search term: "${input.query}".`;
        }
        return `File "Section B.txt" read successfully. Filtered matches for "${input.query}":

${matchedLines.join("\n")}`;
      }
      return `Successfully read Section B.txt data contents:

${fileContent}`;
    } catch (error) {
      return `Failed to read Section B.txt. Error details: ${String(error)}`;
    }
  },
  {
    name: "read_section_a_file",
    description: "Use this tool to read, parse, or lookup information inside the Section B timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
    schema: import_zod2.z.object({
      query: import_zod2.z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Section B.txt.")
    })
  }
);

// src/Tools/SectionCtool.ts
var import_tools3 = require("@langchain/core/tools");
var import_zod3 = require("zod");
var fs3 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var readSectionCTool = (0, import_tools3.tool)(
  async (input) => {
    try {
      const filePath = path4.resolve(process.cwd(), "src", "data", "Section C.txt");
      if (!fs3.existsSync(filePath)) {
        return `Error: The file "Section C.txt" could not be found in the data/ directory.`;
      }
      const fileContent = fs3.readFileSync(filePath, "utf-8");
      if (input.query && input.query.trim() !== "") {
        const lines = fileContent.split("\n");
        const lowerQuery = input.query.toLowerCase();
        const matchedLines = lines.filter((line) => line.toLowerCase().includes(lowerQuery));
        if (matchedLines.length === 0) {
          return `File "Section C.txt" read successfully. No specific matching records found for search term: "${input.query}".`;
        }
        return `File "Section C.txt" read successfully. Filtered matches for "${input.query}":

${matchedLines.join("\n")}`;
      }
      return `Successfully read Section C.txt data contents:

${fileContent}`;
    } catch (error) {
      return `Failed to read Section C.txt. Error details: ${String(error)}`;
    }
  },
  {
    name: "read_section_a_file",
    description: "Use this tool to read, parse, or lookup information inside the Section C timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
    schema: import_zod3.z.object({
      query: import_zod3.z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Section C.txt.")
    })
  }
);

// src/Tools/SectionDtool.ts
var import_tools4 = require("@langchain/core/tools");
var import_zod4 = require("zod");
var fs4 = __toESM(require("fs"));
var path5 = __toESM(require("path"));
var readSectionDTool = (0, import_tools4.tool)(
  async (input) => {
    try {
      const filePath = path5.resolve(process.cwd(), "src", "data", "Section D.txt");
      if (!fs4.existsSync(filePath)) {
        return `Error: The file "Section D.txt" could not be found in the data/ directory.`;
      }
      const fileContent = fs4.readFileSync(filePath, "utf-8");
      if (input.query && input.query.trim() !== "") {
        const lines = fileContent.split("\n");
        const lowerQuery = input.query.toLowerCase();
        const matchedLines = lines.filter((line) => line.toLowerCase().includes(lowerQuery));
        if (matchedLines.length === 0) {
          return `File "Section D.txt" read successfully. No specific matching records found for search term: "${input.query}".`;
        }
        return `File "Section D.txt" read successfully. Filtered matches for "${input.query}":

${matchedLines.join("\n")}`;
      }
      return `Successfully read Section D.txt data contents:

${fileContent}`;
    } catch (error) {
      return `Failed to read Section D.txt. Error details: ${String(error)}`;
    }
  },
  {
    name: "read_section_a_file",
    description: "Use this tool to read, parse, or lookup information inside the Section D timetable and schedule text documentation. You can provide an optional search query string to filter lines.",
    schema: import_zod4.z.object({
      query: import_zod4.z.string().optional().describe("An optional keyword or search term (like a class name, subject, or code) to filter relevant lines from Section D.txt.")
    })
  }
);

// src/Agent/telegram.workflow.ts
var TelegramAgent = new import_langgraph2.StateGraph(telegram_state_default);
TelegramAgent.addNode("Main Agent", async (state) => {
  const history = state.messages || [];
  const prompt = [
    new import_messages.SystemMessage(Supervisorprompt),
    ...history
  ];
  const response = await telegram_model_default.invoke(prompt);
  const aireply = response.content;
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
TelegramAgent.addNode("Section A", async (state) => {
  const SectionAAgent = telegram_model_default.bindTools([readSectionATool]);
  const response = await SectionAAgent.invoke([...state.messages]);
  return {
    messages: [response]
  };
});
TelegramAgent.addConditionalEdges(
  "Section A",
  import_prebuilt.toolsCondition,
  {
    true: "Section A Tools",
    false: "Main Agent"
  }
);
TelegramAgent.addNode("Section A Tools", new import_prebuilt.ToolNode([readSectionATool]));
TelegramAgent.addNode("Section B", async (state) => {
  const SectionBAgent = telegram_model_default.bindTools([readSectionBTool]);
  const response = await SectionBAgent.invoke([...state.messages]);
  return {
    messages: [response]
  };
});
TelegramAgent.addConditionalEdges(
  "Section B",
  import_prebuilt.toolsCondition,
  {
    true: "Section B Tools",
    false: "Main Agent"
  }
);
TelegramAgent.addNode("Section B Tools", new import_prebuilt.ToolNode([readSectionBTool]));
TelegramAgent.addNode("Section C", async (state) => {
  const SectionCAgent = telegram_model_default.bindTools([readSectionCTool]);
  const response = await SectionCAgent.invoke([...state.messages]);
  return {
    messages: [response]
  };
});
TelegramAgent.addConditionalEdges(
  "Section C",
  import_prebuilt.toolsCondition,
  {
    true: "Section C Tools",
    false: "Main Agent"
  }
);
TelegramAgent.addNode("Section C Tools", new import_prebuilt.ToolNode([readSectionCTool]));
TelegramAgent.addNode("Section D", async (state) => {
  const SectionDAgent = telegram_model_default.bindTools([readSectionDTool]);
  const response = await SectionDAgent.invoke([...state.messages]);
  return {
    messages: [response]
  };
});
TelegramAgent.addConditionalEdges(
  "Section D",
  import_prebuilt.toolsCondition,
  {
    true: "Section D Tools",
    false: "Main Agent"
  }
);
TelegramAgent.addNode("Section D Tools", new import_prebuilt.ToolNode([readSectionDTool]));
TelegramAgent.addEdge(import_langgraph2.START, "Main Agent");
TelegramAgent.addConditionalEdges(
  "Main Agent",
  (state) => state.nextAgent,
  {
    "Section A": "Section A",
    "Section B": "Section B",
    "Section C": "Section C",
    "Section D": "Section D",
    "Main Agent": "Main Agent",
    "__end__": import_langgraph2.END
  }
);
TelegramAgent.addEdge("Section A Tools", "Section A");
TelegramAgent.addEdge("Section B Tools", "Section B");
TelegramAgent.addEdge("Section C Tools", "Section C");
TelegramAgent.addEdge("Section D Tools", "Section D");
var TelegramTimetableagent = TelegramAgent.compile();
var telegram_workflow_default = TelegramTimetableagent;

// src/lib/telegram.ts
var import_node_telegram_bot_api = __toESM(require("node-telegram-bot-api"));
var bot = new import_node_telegram_bot_api.default(
  process.env.BOT,
  { polling: false }
);
var telegram_default = bot;

// src/modules/telegram.command.ts
var Telegramcommand = class {
  static commands = [
    "/help",
    //Help Functions
    "/Section A",
    //Section A
    "/Section B",
    //Section B
    "/Section C",
    //Section C
    "/Section D"
    //Section D
  ];
};

// src/modules/telegram.controller.ts
var Telegramcontroller = class _Telegramcontroller extends Telegramcommand {
  static telegram = async (req, res) => {
    try {
      const chatid = req.body.message?.chat?.id;
      const text = req.body.message?.text;
      if (text.startsWith(_Telegramcontroller.commands[0])) {
        await telegram_default.sendMessage(chatid, "You can use commands /Section A,/Section B,/Section C,/Section D for each timetable.");
      } else if (text.startsWith("/Section A") || text.startsWith("/Section B") || text.startsWith("/Section C") || text.startsWith("/Section D")) {
        const eventStream = await telegram_workflow_default.streamEvents(
          { messages: [new import_messages2.HumanMessage(text)] },
          { version: "v2" }
        );
        let statusMessageId = null;
        let finalAnswer = "";
        for await (const event of eventStream) {
          if (event.event === "on_chain_start" && event.metadata?.langgraph_node) {
            const nodeName = event.metadata.langgraph_node;
            if (nodeName === "Main Agent") continue;
            const statusMessage = nodeName.includes("Tools") ? `${nodeName.replace("Tools", "").trim()} is currently executing tools...` : `${nodeName} is processing your request...`;
            if (statusMessageId === null) {
              const sentMessage = await telegram_default.sendMessage(chatid, statusMessage);
              statusMessageId = sentMessage.message_id;
            } else {
              try {
                await telegram_default.editMessageText(statusMessage, {
                  chat_id: chatid,
                  message_id: statusMessageId
                });
              } catch (error) {
                console.error("Telegram edit error:", error);
              }
            }
          }
          if (event.event === "on_chain_end" && event.metadata?.langgraph_node === "Main Agent") {
            const outputMessages = event.data?.output?.messages;
            if (outputMessages && outputMessages.length > 0) {
              finalAnswer = outputMessages[outputMessages.length - 1].content || "";
            }
          }
        }
        if (statusMessageId !== null && finalAnswer) {
          try {
            await telegram_default.editMessageText(finalAnswer, {
              chat_id: chatid,
              message_id: statusMessageId
            });
          } catch (error) {
            await telegram_default.sendMessage(chatid, finalAnswer);
          }
        }
      }
      return res.status(200).json({
        success: true
      });
    } catch (err) {
      console.error("Telegram Controller Error:", err);
      const chatid = req.body?.message?.chat?.id;
      await telegram_default.sendMessage(chatid, "It seems something went wrong.");
      return res.status(500).json({
        success: false,
        error: "Internal Server Error"
      });
    }
  };
};

// src/modules/telegram.route.ts
var telegramroute = import_express.default.Router();
telegramroute.post("/webhook", Telegramcontroller.telegram);
var telegram_route_default = telegramroute;

// src/index.ts
var app = (0, import_express2.default)();
app.use(import_express2.default.json());
app.use((0, import_cors.default)());
app.use("/", telegram_route_default);
app.listen(3e3, async () => {
  console.log("Server running on port 3000");
});
