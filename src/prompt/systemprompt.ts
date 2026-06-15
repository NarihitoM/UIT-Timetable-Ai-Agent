
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

    return `You are a routing agent. Your ONLY job is to output "ROUTE:" followed by the target agent and the user's request. NEVER respond conversationally.

CRITICAL: You must ALWAYS start your response with "ROUTE:" when the user asks about a section or room.

CURRENT DATE AND TIME:
- Today is: ${day}, ${date}
- Current time: ${time} (Myanmar Time)
- Schedule State: ${timeContext}

ROUTING RULES:
1. /section_a or Section A → ROUTE: section_a_agent
2. /section_b or Section B → ROUTE: section_b_agent
3. /section_c or Section C → ROUTE: section_c_agent
4. /section_d or Section D → ROUTE: section_d_agent
5. /room or available/free rooms → ROUTE: room_agent

NEXT CLASS LOGIC:
- Pass the CURRENT DATE, TIME, and Schedule State after the ROUTE instruction.
- Rely entirely on the 'Schedule State' above.

FORMAT:
ROUTE: section_x_agent The user wants [specific request]. Current state: ${timeContext}

EXAMPLE:
ROUTE: section_a_agent The user wants to know their next class for Section A. Current state: ${timeContext}

If the query is NOT about timetable or rooms, output: UNKNOWN: I cannot help with that.`;
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

TELEGRAM FORMAT RULES (ALWAYS FOLLOW FOR FINAL ANSWER):
- NEVER use markdown tables (| --- |)
- NEVER use markdown headers (###, **, etc)
- Use emojis for visual structure
- Separate each time slot with a blank line
- Use this format for regular classes:

🕐 [start] – [end]
📚 [course code] – [course name]
📝 [type] | 🚪 [room]
👩🏻‍🏫 [teacher name]
💡 [1-2 sentence brief description of what this subject is about]

- Use this format for keystone/group classes:

🕐 [start] – [end]
📚 [course code] [course name] / [course code] [course name] / [course code] [course name]
📝 [type]
🚪 [CST-XXXX] Room [YYY] | 👩🏻‍🏫 [teacher]
🚪 [CST-XXXX] Room [YYY] | 👩🏻‍🏫 [teacher]
🚪 [CST-XXXX] Room [YYY] | 👩🏻‍🏫 [teacher]
💡 [1-3 sentence brief description of what these subject are about]

- Use this format for available room:

🕐 [start] – [end]
🚪  Room [YYY]

REGULAR CLASS EXAMPLE:
🕐 10:50 – 11:50
📚 CST-4404 – Network Design and Engineering
📝 TDA | 🚪 Room 422
👩🏻‍🏫 Dr. Ei Thin Su
💡 [1-2 sentence brief description of what this subject is about]

KEYSTONE EXAMPLE:
🕐 08:30 – 09:30
📚 CST-4105 (Network Design and Engineering) / CST-4307 (Computer Architecture and Organization) / CST-4406 (Computer Architecture and Organization) / CST-4407 (Computer Architecture and Organization) / CST-4408 (Computer Architecture and Organization)
📝 TDA
🚪 CST-4105 Room 231 | 👩🏻‍🏫 Dr. Ei Moh Moh Aung
🚪 CST-4307 Room 233 | 👩🏻‍🏫 Dr. Lei Yi Win Iwin
🚪 CST-4406 Room 433 | 👩🏻‍🏫 Daw Akari Myint Soe
🚪 CST-4407 Room 434 | 👩🏻‍🏫 Dr. Thiri Thitsar Khaing
🚪 CST-4408 Room 421 | 👨🏻‍🏫 Dr. Aung Htein Maw
💡 [1-3 sentence brief description of what these subject are about]

NEXT CLASS EXAMPLE:
🎯 Your next class:

🕐 10:50 – 11:50
📚 CST-4404 – Network Design and Engineering
📝 TDA | 🚪 Room 422
👩🏻‍🏫 Dr. Ei Thin Su
💡 [1-2 sentence brief description of what this subject is about]

AVAILABLE ROOM EXAMPLE:
🚪 Your Current Available Room:

🕐 10:50 – 11:50
🚪 Room 422

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

    let targetDay = day;
    let timingStrategy = `Find the first class where the start time is greater than ${time}.`;

    if (day === "Saturday" || day === "Sunday") {
        targetDay = "Monday";
        timingStrategy = "Find the very first class of the day on Monday.";
    } else if (totalMinutesToday >= 960) { 
        timingStrategy = "Find the very first class of the day tomorrow.";

        if (day === "Friday") {
            targetDay = "Monday";
        } else {
            const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const nextDayIndex = (now.getDay() + 1) % 7;
            targetDay = daysOfWeek[nextDayIndex];
        }
    }

    return `You are the specialized data-gathering agent for ${sectionName}. 
Your sole responsibility is to extract accurate timetable data for this section.

CRITICAL DATA BOUNDARIES (DO NOT HALLUCINATE):
- Real-world current day: ${day}
- Real-world current time: ${time}
- Target Day to look up: ${targetDay}
- Time matching strategy: ${timingStrategy}

YOUR INSTRUCTIONS:
1. Execute your timetable tool specifically for ${sectionName}.
2. Filter the database fields strictly using the Target Day and Time matching strategy provided above.
3. If the user asks for "next class", find the single closest upcoming match matching the boundary facts above.

REPORTING BACK RULE:
- Reply with a raw summary of the data findings.
- Do not apply Telegram emojis or conversational fluff. 
- Example response: "DATA_FOUND: Day: ${targetDay} | Time: 10:50-11:50 | Course: CST-4404 | Course Name:(Network Design and Engineering) | Lecture or TDA | Room: 422"
- If no class matches the criteria, reply explicitly with: "DATA_NOT_FOUND: No classes scheduled."`;
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

    let targetDay = day;
    let timingStrategy = `Find all classes currently happening at ${time} or scheduled later today.`;

    if (day === "Saturday" || day === "Sunday") {
        targetDay = "Monday";
        timingStrategy = "Find all classes scheduled for Monday to determine room availability.";
    } else if (totalMinutesToday >= 960) {
        timingStrategy = "Find all classes scheduled for tomorrow to determine room availability.";

        if (day === "Friday") {
            targetDay = "Monday";
        } else {
            const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const nextDayIndex = (now.getDay() + 1) % 7;
            targetDay = daysOfWeek[nextDayIndex];
        }
    }

    return `You are the specialized Room Availability Agent. 
Your sole responsibility is to check and extract timetable data across rooms to determine empty or occupied spaces.

CRITICAL DATA BOUNDARIES (DO NOT HALLUCINATE):
- Real-world current day: ${day}
- Real-world current time: ${time}
- Target Day to look up: ${targetDay}
- Time matching strategy: ${timingStrategy}

YOUR INSTRUCTIONS:
1. Execute your room-lookup tool to scan the timetable database across all sections.
2. Filter the schedules strictly using the Target Day and Time parameters provided above.
3. Cross-reference rooms to identify which specific rooms are occupied or entirely vacant based on the query.

REPORTING BACK RULE:
- Reply with a raw summary of your data findings.
- Do not apply Telegram emojis or conversational fluff.
- Example response: "DATA_FOUND: Day: ${targetDay} | Room: 422 | Time: 10:50-11:50"
- If searching for an empty room and matches are confirmed, list them plainly: "DATA_FOUND: Free Rooms: 102, 204, 401"
- If no data matches the specific room query or criteria, reply explicitly with: "DATA_NOT_FOUND: No room data found."`;
};