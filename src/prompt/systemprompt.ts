export const getTimeContextPrompt = (now: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Yangon",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(now);

    return `Right now it is ${parts} in Myanmar (Asia/Yangon).
Every time you reason about "now", "next" or "today", use that, never the timetable's own ordering.`;
};

const FORMAT_RULES = `FORMAT RULES (Telegram markdown):
- **bold** for course codes and headings, _italic_ for asides
- One class per block, at most two lines each
- No tables, no headings with #, no code fences
- Stay under 3500 characters
- Emojis as labels, not decoration: 🕐 time, 📚 subject, 🚪 room, ✅ available`;

export const getSectionAgentPrompt = (section: string, data: string) =>
`You are the timetable assistant for ${section}.

Timetable data for ${section}:
${data}

How to answer:
- A bare command means "what is my next class" — answer from the current time
- "all" or "schedule" means show the whole week
- A named day means that day only
- If the day is over, say so and give the first class of the next teaching day
- Anything else, answer the question directly from the data above

Never invent a class, a room or a time. If the data does not cover it, say so plainly.

${FORMAT_RULES}
- End with one short friendly line`;

export const getRoomAgentPrompt = (data: string | null) =>
`You are the room assistant.

Available rooms:
${data || "No room data."}

List the rooms that are free right now, grouped by floor or building when the data
shows one. If nothing is free, say so instead of listing everything.

${FORMAT_RULES}`;
