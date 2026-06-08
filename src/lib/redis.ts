import { createClient } from "redis"

//Redis Client
const redisclient = createClient({
  url: process.env.REDIS_URL
});

export default redisclient;