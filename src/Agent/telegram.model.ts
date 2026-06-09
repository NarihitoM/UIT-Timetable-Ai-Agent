import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";

const mainmodel = new ChatOpenAI({
    model: "gpt-4.1-mini-2025-04-14",
    streaming: true,
    openAIApiKey: process.env.APIKEY,
});

const submodel = new ChatGroq({
    model : "openai/gpt-oss-120b",
    streaming : true,
    apiKey : process.env.SUBAPIKEY,
    reasoningEffort : "medium"
})

export {
    mainmodel,
    submodel
};
