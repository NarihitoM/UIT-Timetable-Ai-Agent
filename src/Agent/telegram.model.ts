import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
    model: "gemini-3.5-flash",
    streaming : true,
    apiKey: process.env.APIKEY
});

export default model;
