import { ChatMistralAI } from "@langchain/mistralai";
import { ChatOpenAI } from "@langchain/openai";

const mainmodel = new ChatOpenAI({
    model: "gpt-4.1-mini-2025-04-14",
    apiKey: process.env.APIKEY,
});

const submodel = new ChatMistralAI({
    model : "mistral-large-2512",
    apiKey : process.env.SUBAPIKEY,
})

export {
    mainmodel,
    submodel
};
