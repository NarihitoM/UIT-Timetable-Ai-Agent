import "../src/config/env.ts";
import express from "express"
import cors from "cors";
import telegramroute from "./modules/telegram.route.ts";
import { connectRedis } from "./lib/redis.ts";

const app = express();

//Express configure
app.use(express.json())
app.use(cors());


app.use(async (req, res, next) => {
  try {
    await connectRedis();
    next();
  } catch (error) {
    console.error("Failed to establish Redis connection in middleware:", error);
    next(); 
  }
});

app.use("/",telegramroute);


//Server Listen
export default app;
