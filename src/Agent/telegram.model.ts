import { ChatGroq } from "@langchain/groq";

const mainmodel =  new ChatGroq({
    model : "openai/gpt-oss-120b",
    apiKey : process.env.APIKEY,
    timeout: 20000,
});

const submodel = new ChatGroq({
    model : "openai/gpt-oss-120b",
    apiKey : process.env.SUBAPIKEY,
    timeout: 20000,
})


export {
    mainmodel,
    submodel
};
