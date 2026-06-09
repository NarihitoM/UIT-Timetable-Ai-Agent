import { createClient } from "redis"

//Redis Client
export const redisclient = createClient({
  url: process.env.REDIS_URL
});


redisclient.on('error', err => console.log('Redis Client Error', err));


export const connectRedis = async () => {
    if (!redisclient.isOpen) {
        await redisclient.connect();
        console.log("Redis connected");
    }
};

