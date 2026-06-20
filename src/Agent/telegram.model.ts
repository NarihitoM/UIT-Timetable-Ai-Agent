import { ChatGroq } from "@langchain/groq";

const mainmodel =  new ChatGroq({
    model : "llama-3.3-70b-versatile",
    apiKey : process.env.APIKEY,
    timeout: 30000,
});

const submodel = new ChatGroq({
    model : "llama-3.3-70b-versatile",
    apiKey : process.env.SUBAPIKEY,
    timeout: 30000,
})


export {
    mainmodel,
    submodel
};
