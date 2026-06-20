import { ChatGroq } from "@langchain/groq";

const mainmodel =  new ChatGroq({
    model : "openai/gpt-oss-120b",
    apiKey : process.env.APIKEY,
});

const submodel = new ChatGroq({
    model : "openai/gpt-oss-120b",
    apiKey : process.env.SUBAPIKEY,
})


export {
    mainmodel,
    submodel
};
