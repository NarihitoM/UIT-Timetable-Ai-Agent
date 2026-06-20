import { ChatGroq } from "@langchain/groq";

const mainmodel =  new ChatGroq({
    model : "llama-3.3-70b-versatile",
    apiKey : process.env.APIKEY,
});

const submodel = new ChatGroq({
    model : "llama-3.3-70b-versatile",
    apiKey : process.env.SUBAPIKEY,
})


export {
    mainmodel,
    submodel
};
