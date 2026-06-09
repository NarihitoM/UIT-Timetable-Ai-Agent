import { ChatGroq } from "@langchain/groq"

const model = new ChatGroq({
    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    streaming : true,
    apiKey: process.env.GROQ_API_KEY
});

export default model;
