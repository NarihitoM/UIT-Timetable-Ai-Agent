import telegramify from "telegramify-markdown";

// The model writes ordinary markdown. Telegram's MarkdownV2 needs a dozen characters
// escaped and rejects the whole message if one is missed, so convert instead of trusting it.
export const toTelegramMarkdown = (text: string): string => {
    try {
        return telegramify(text, "escape");
    } catch (err) {
        console.error("toTelegramMarkdown failed:", err);
        return text;
    }
};
