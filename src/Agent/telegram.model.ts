import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";

const mainmodel = new ChatOpenAI({
    model: "gpt-4.1-mini-2025-04-14",
    streaming: true,
    apiKey: process.env.APIKEY,
});

const submodel = new ChatGroq({
    model : "meta-llama/llama-4-scout-17b-16e-instruct",
    streaming : true,
    apiKey : process.env.SUBAPIKEY,
})

export {
    mainmodel,
    submodel
};
