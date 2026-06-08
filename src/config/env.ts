import { configDotenv } from "dotenv";
import path from "path";

configDotenv({ path: path.resolve(process.cwd(), ".env") });