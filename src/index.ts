import "../src/config/env.ts";
import express from "express"
import cors from "cors";
import telegramroute from "./modules/telegram.route.ts";
import { connectRedis, redisclient } from "./lib/redis.ts";
import { prisma } from "./lib/prisma.ts";

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

//Reports whether the deployment can actually reach its dependencies, never what they are
app.get("/health", async (_req, res) => {
  const health: Record<string, string> = {};

  try {
    await prisma.chat.count();
    health.database = "ok";
  } catch (err) {
    health.database = `failed: ${(err as Error).message.split("\n")[0]}`;
  }

  try {
    await redisclient.ping();
    health.redis = "ok";
  } catch (err) {
    health.redis = `failed: ${(err as Error).message.split("\n")[0]}`;
  }

  const ok = Object.values(health).every(v => v === "ok");
  return res.status(ok ? 200 : 503).json(health);
});

app.use("/",telegramroute);


//Server Listen
export default app;
