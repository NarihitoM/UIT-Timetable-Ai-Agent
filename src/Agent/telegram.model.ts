import { ChatGroq } from "@langchain/groq";

const model = new ChatGroq({
    model: "openai/gpt-oss-20b",
    streaming : true,
    apiKey: process.env.APIKEY
});

export default model;
