import express from "express"
import { Telegramcontroller } from "./telegram.controller.ts";
import { BaseMiddleware } from "../shared/middlewares/telegramchannel.middleware.ts";

const telegramroute = express.Router();

telegramroute.post("/webhook", BaseMiddleware.Telegrammiddleware, Telegramcontroller.telegram);

export default telegramroute;