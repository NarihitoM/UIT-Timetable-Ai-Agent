import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import { prisma } from "./prisma.ts";

const HISTORY_LIMIT = 6;

export const loadHistory = async (chatid: number): Promise<BaseMessage[]> => {
    try {
        const rows = await prisma.chat.findMany({
            where: { chatid: BigInt(chatid) },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: HISTORY_LIMIT
        });

        return rows
            .reverse()
            .map(row => row.role === "assistant"
                ? new AIMessage(row.message)
                : new HumanMessage(row.message));
    } catch (err) {
        console.error("loadHistory failed:", err);
        return [];
    }
};

export const saveTurn = async (chatid: number, question: string, answer: string): Promise<void> => {
    try {
        await prisma.chat.createMany({
            data: [
                { chatid: BigInt(chatid), role: "user", message: question },
                { chatid: BigInt(chatid), role: "assistant", message: answer }
            ]
        });
    } catch (err) {
        console.error("saveTurn failed:", err);
    }
};
