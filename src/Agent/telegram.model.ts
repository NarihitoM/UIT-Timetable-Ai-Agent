import { ChatGroq } from "@langchain/groq";

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    streaming : true,
    apiKey: process.env.APIKEY,
    reasoningEffort : "medium"
});

export default model;
