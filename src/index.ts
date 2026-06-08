import "../src/config/env.ts";
import express from "express"
import cors from "cors";
import telegramroute from "./modules/telegram.route.ts";

const app = express();

//Express configure
app.use(express.json())
app.use(cors());

app.use("/",telegramroute);

//Server Listen
export default app;
