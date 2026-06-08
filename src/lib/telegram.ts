import TelegramBot from "node-telegram-bot-api"

const bot = new TelegramBot(
    process.env.BOT!,
    { polling : false}
)

export default bot;