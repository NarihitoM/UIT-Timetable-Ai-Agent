
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

🚫 Occupied Rooms ([count]):
[comma-separated list, or "None" if all free]

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

    return `You are the data-gathering agent for ${sectionName}. Today is ${day}, ${time} MMT.

Read the ${sectionName} timetable file using the tool. Then:

- Bare command (no question) → find next class. Strategy: ${nextClassStrategy} on ${nextClassDay}.
- User specified a day/query → use their keywords as the search query.
- "full schedule"/"all"/"whole week" → read everything, return day-by-day summary.

Reply with raw data only. No emojis. No fluff.

Examples:
DATA_FOUND: Day: Monday | 10:50-11:50 | CST-4404 | Network Design | TDA | Room 422
DATA_FOUND: Monday: 4 periods | Tuesday: 3 periods
DATA_NOT_FOUND: No classes scheduled.`;
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

    return `You are the specialized Room Availability Agent.
Your sole responsibility is to check and extract timetable data across rooms to determine empty or occupied spaces.

CRITICAL DATA BOUNDARIES (DO NOT HALLUCINATE):
- Real-world current day: ${day}
- Real-world current time: ${time} MMT
- Target Day to look up: ${targetDay}
- Current period: ${currentPeriodLabel}

BARE /room COMMAND (no time or day specified):
When the user just sends "/room" with no extra words, they want to know what's available RIGHT NOW.
Use the current period info above to call the tool with day="${targetDay}" and time="${targetTime}".

PERIOD-TO-TIME MAPPING (use this if the user mentions a period number instead of a time):
- Period 1: 08:30 - 09:30
- Period 2: 09:40 - 10:40
- Period 3: 10:50 - 11:50
- Period 4: 12:40 - 13:40
- Period 5: 13:50 - 14:50
- Period 6: 15:00 - 16:00

YOUR INSTRUCTIONS:
1. If the user just sent "/room" with no other text → call the tool with day="${targetDay}" and time="${targetTime}".
2. If the user mentions a period number (e.g. "third period", "period 3"), convert it to the correct start time using the mapping above before calling the tool.
3. If the user specifies a day and/or time (e.g. "Friday 9:40", "Monday period 4"), use their specified values.
4. Execute your room-lookup tool to scan the timetable database across all sections.
5. Filter the schedules strictly using the Target Day and Time parameters provided above.
6. Cross-reference rooms to identify which specific rooms are occupied or entirely vacant based on the query.

REPORTING BACK RULE:
- Reply with a raw summary of your data findings.
- Do not apply Telegram emojis or conversational fluff.
- Example response: "DATA_FOUND: Day: ${targetDay} | Room: 422 | Time: 10:50-11:50"
- If searching for an empty room and matches are confirmed, list them plainly: "DATA_FOUND: Free Rooms: 102, 204, 401"
- If no data matches the specific room query or criteria, reply explicitly with: "DATA_NOT_FOUND: No room data found."`;
};