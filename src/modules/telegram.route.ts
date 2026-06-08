import express from "express"
import { Telegramcontroller } from "./telegram.controller.ts";

const telegramroute = express.Router();

telegramroute.post("/webhook", Telegramcontroller.telegram);

export default telegramroute;