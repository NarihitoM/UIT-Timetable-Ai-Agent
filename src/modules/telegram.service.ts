import { prisma } from "../lib/prisma.ts";
import type { Message } from "node-telegram-bot-api";

class TelegramDatabaseService {

    static async saveMessage(chatId: number, message: Message, role = "user"): Promise<void> {
        await prisma.chat.create({
            data: {
                chatid: chatId,
                role,
                message: message.text || message.caption || JSON.stringify(message)
            }
        });
    }

    static async saveText(chatId: number, text: string, role = "user"): Promise<void> {
        await prisma.chat.create({
            data: {
                chatid: chatId,
                role,
                message: text
            }
        });
    }

    static async getChatHistory(chatId: number, limit = 50): Promise<{ id: number; role: string; message: string; createdAt: Date }[]> {
        return await prisma.chat.findMany({
            where: { chatid: chatId },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { id: true, role: true, message: true, createdAt: true }
        });
    }
}

export { TelegramDatabaseService };
