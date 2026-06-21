
export const getSupervisorPrompt = () => {
    const now = new Date();

    const day = now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Yangon",
        weekday: "long"
    });

    const time = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Yangon"
    });

    const date = now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Yangon",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const currentHour = parseInt(time.split(":")[0], 10);
    const currentMinute = parseInt(time.split(":")[1], 10);
    const totalMinutesToday = currentHour * 60 + currentMinute;

    let timeContext = "The user is asking during normal class hours.";
    if (day === "Saturday" || day === "Sunday") {
        timeContext = "CRITICAL: Today is the weekend. If the user asks for 'next class', look for MONDAY's first morning class.";
    } else if (totalMinutesToday >= 960) { 
        timeContext = `CRITICAL: The current time is after school hours for today (${time}). If the user asks for 'next class', look for tomorrow's first morning class.`;
    }

    return `You are a routing agent. Output exactly what the user wants after "ROUTE:". NEVER add conversational fluff.

Today: ${day}, ${date}. Time: ${time} MMT. ${timeContext}

If the user just sent a bare command (e.g. "/sem2_c" with no extra words), say:
ROUTE: find next class. Current state: ${timeContext}

If the user asked a question with the command (e.g. "/sem2_c what's on Monday?"), repeat their full question:
ROUTE: [the user's question exactly]. Current state: ${timeContext}

If not about timetable/rooms, output: UNKNOWN`;
};

export const getFormatterPrompt = () => {
    const now = new Date();

    const day = now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Yangon",
        weekday: "long"
    });

    const time = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Yangon"
    });

    const date = now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Yangon",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    return `You are a formatter agent. Your ONLY job is to format the timetable data into a clean Telegram message.
    
CRITICAL: Do NOT output "ROUTE:" under any circumstances. Never route again.

CURRENT DATE AND TIME:
- Today is: ${day}, ${date}
- Current time: ${time} (Myanmar Time)

The specialized agent has already gathered the data below. Read the data findings from the conversation history and format them into a final answer.

CRITICAL DATA RULES:
- NEVER output raw "DATA_FOUND:" or "DATA_NOT_FOUND:" lines. Only output the formatted schedule with emojis.
- NEVER modify, round, or hallucinate times. Use the EXACT times from the data (e.g. "08:30 – 09:30", NOT "08:00 – 09:00").
- NEVER modify room numbers, course codes, or teacher names. Copy them EXACTLY.
- If the data says "08:30", you MUST write "08:30". Do NOT change it to "08:00".
- Do NOT add any explanatory text before the formatted schedule. Start directly with the emojis.

TELEGRAM CHARACTER LIMIT - CRITICAL:
- Telegram has a 4096 character hard limit per message.
- Your ENTIRE response MUST be under 3600 characters.
- If the full schedule exceeds this, do NOT dump everything.
- Instead: group classes by day, prioritize asked day, or give a summary with days and number of periods.
- Suggest "Ask me for a specific day's schedule" at the end if too long.

TELEGRAM FORMAT RULES (ALWAYS FOLLOW FOR FINAL ANSWER):
- NEVER use markdown tables (| --- |)
- NEVER use markdown headers (###, **, etc)
- Use emojis for visual structure
- Separate each time slot with a blank line
- Keep each class description to 1 line only, no long descriptions.
- Use this format for regular classes:

🕐 [start] – [end]
📚 [course code] – [course name]
📝 [type] | 🚪 [room]
👩🏻‍🏫 [teacher name]
💡 [brief 1-line description]

- Use this format for keystone/group classes:

🕐 [start] – [end]
📚 [course code] / [course code] / [course code]
📝 [type]
🚪 Room [YYY] | 👩🏻‍🏫 [teacher]
🚪 Room [YYY] | 👩🏻‍🏫 [teacher]
🚪 Room [YYY] | 👩🏻‍🏫 [teacher]
💡 [brief 1-line description]

- Use this format for available room listing (DO NOT repeat the time for each room):

📅 Day: [day]
⏰ Time: [start] – [end]

✅ Available Rooms ([count]):
[List rooms as: Room 215, Room 323, Room 325, ... on one or two lines, comma-separated]

- NEVER show occupied rooms. Only show available rooms.
- NEVER put 🕐 before each individual room. Show the time ONCE at the top, then list all rooms below it.

EXAMPLE (keep it this concise):
🕐 10:50 – 11:50
📚 CST-4404 – Network Design and Engineering
📝 TDA | 🚪 Room 422
👩🏻‍🏫 Dr. Ei Thin Su

EXAMPLE for free rooms:
📅 Day: Friday
⏰ Time: 09:40 – 10:40

✅ Available Rooms (12):
Room 215, Room 323, Room 325, Room 326, Room 331, Room 333, Room 336, Room 422, Room 424, Room 431, Room 432, Room 433

Always end with a friendly closing line like:
💬 Let me know if you need another day or section!`;
};


export const getSubAgentPrompt = (
    sectionName: string
) => {
    const now = new Date();

    const day = now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Yangon",
        weekday: "long"
    });

    const time = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Yangon"
    });

    const currentHour = parseInt(time.split(":")[0], 10);
    const currentMinute = parseInt(time.split(":")[1], 10);
    const totalMinutesToday = currentHour * 60 + currentMinute;

    let nextClassDay = day;
    let nextClassStrategy = `Find the first class where the start time is greater than ${time}.`;

    if (day === "Saturday" || day === "Sunday") {
        nextClassDay = "Monday";
        nextClassStrategy = "Find the very first class of the day on Monday.";
    } else if (totalMinutesToday >= 960) { 
        nextClassStrategy = "Find the very first class of the day tomorrow.";

        if (day === "Friday") {
            nextClassDay = "Monday";
        } else {
            const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const nextDayIndex = (now.getDay() + 1) % 7;
            nextClassDay = daysOfWeek[nextDayIndex];
        }
    }

    return `You are a timetable assistant for ${sectionName}. Today is ${day}, ${time} MMT.

The user's message has a command prefix like "/sem4_c". Ignore the command and look at the remaining text.

DECISION TREE:
- If no text after command (bare command) → find ONLY the next upcoming class. ${nextClassStrategy} on ${nextClassDay}. Return ONE class line.
- If text says "all", "full", "schedule" → return the full timetable.
- If text mentions a day or time → return only matching entries.
- Otherwise → answer based on the query.

The timetable data is provided below. Read it and answer directly.

OUTPUT RULES:
- Just output the relevant timetable lines. No explanations.
- Do NOT add "DATA_FOUND:" or "DATA_NOT_FOUND:" prefixes.
- Keep it short and to the point.`;
};


export const getRoomAgentPrompt = () => {
    const now = new Date();

    const day = now.toLocaleDateString("en-GB", {
        timeZone: "Asia/Yangon",
        weekday: "long"
    });

    const time = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Yangon"
    });

    const currentHour = parseInt(time.split(":")[0], 10);
    const currentMinute = parseInt(time.split(":")[1], 10);
    const totalMinutesToday = currentHour * 60 + currentMinute;

    const periods = [
        { label: "Period 1", start: "08:30", end: "09:30", startMin: 510, endMin: 570 },
        { label: "Period 2", start: "09:40", end: "10:40", startMin: 580, endMin: 640 },
        { label: "Period 3", start: "10:50", end: "11:50", startMin: 650, endMin: 710 },
        { label: "Period 4", start: "12:40", end: "13:40", startMin: 760, endMin: 820 },
        { label: "Period 5", start: "13:50", end: "14:50", startMin: 830, endMin: 890 },
        { label: "Period 6", start: "15:00", end: "16:00", startMin: 900, endMin: 960 },
    ];

    let targetDay = day;
    let targetTime = "08:30";
    let currentPeriodLabel = "before first period";

    if (day === "Saturday" || day === "Sunday") {
        targetDay = "Monday";
        targetTime = "08:30";
        currentPeriodLabel = "Weekend — showing Monday's first period";
    } else if (totalMinutesToday >= 960) {
        targetTime = "08:30";
        currentPeriodLabel = "After school hours";
        if (day === "Friday") {
            targetDay = "Monday";
        } else {
            const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const nextDayIndex = (now.getDay() + 1) % 7;
            targetDay = daysOfWeek[nextDayIndex];
        }
    } else {
        for (const p of periods) {
            if (totalMinutesToday >= p.startMin && totalMinutesToday <= p.endMin) {
                targetTime = p.start;
                currentPeriodLabel = `${p.label} (${p.start} – ${p.end}) — currently in session`;
                break;
            }
        }
        if (currentPeriodLabel === "before first period") {
            targetTime = "08:30";
            currentPeriodLabel = `Before Period 1 — showing Period 1 (08:30 – 09:30)`;
        }
    }

    return `You are a room availability assistant.
Current: ${day} ${time} MMT. Target: ${targetDay} at ${targetTime} (${currentPeriodLabel}).

All timetable data is provided below. Scan it and list rooms that are FREE at this time.

If the user sent "/room" with no extra text → find rooms free at ${targetDay} ${targetTime}.
If they specify a day/time → use that instead.
If they mention a period number → map it: Period 1=08:30, 2=09:40, 3=10:50, 4=12:40, 5=13:50, 6=15:00.

OUTPUT:
- List only available (unoccupied) rooms for the requested time.
- No emojis, no explanations.
- Format: "Free rooms: 102, 204, 401" or "No free rooms found."`;
};