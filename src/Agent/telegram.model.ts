import { ChatGroq } from "@langchain/groq"

const model = new ChatGroq({
    model: "openai/gpt-oss-120b",
    streaming : true,
    apiKey: process.env.GROQ_API_KEY
});

export default model;
