import "../src/config/env.ts";
import express from "express"
import cors from "cors";
import telegramroute from "./modules/telegram.route.ts";
import { connectRedis } from "./lib/redis.ts";

const app = express();

//Express configure
app.use(express.json())
app.use(cors());

app.use("/",telegramroute);


async function main() {
  await connectRedis();
}

main().catch(console.error);

//Server Listen
export default app;
