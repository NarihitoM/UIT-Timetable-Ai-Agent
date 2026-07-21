import { ChatGroq } from "@langchain/groq";

export const GROQ_MODEL = "openai/gpt-oss-120b";

const submodel = new ChatGroq({
    model: GROQ_MODEL,
    apiKey: process.env.SUBAPIKEY,
})

export {
    submodel
};
