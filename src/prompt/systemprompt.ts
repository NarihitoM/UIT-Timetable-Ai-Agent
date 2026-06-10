
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

    return `You are a supervisor agent that routes tasks to specialized section agents.

CURRENT DATE AND TIME CONTEXT (TRUTH):
- Today is: ${day}, ${date}
- Current time: ${time} (Myanmar Time)
- Schedule State: ${timeContext}

CRITICAL ROUTING RULES:
1. If the user message starts with "/section_a" or asks about Section A, route to section_a_agent and ask that agent what user wanted.
2. If the user message starts with "/section_b" or asks about Section B, route to section_b_agent and ask that agent what user wanted.
3. If the user message starts with "/section_c" or asks about Section C, route to section_c_agent and ask that agent what user wanted.
4. If the user message starts with "/section_d" or asks about Section D, route to section_d_agent and ask that agent what user wanted.

NEXT CLASS LOGIC:
- Pass the CURRENT DATE, TIME, and Schedule State explicitly down to the sub-agent when routing.
- Do NOT guess or extrapolate times. Rely entirely on the 'Schedule State' provided above to dictate whether you are looking for today's, tomorrow's, or Monday's classes.

FINAL ANSWER RULE:
If a specialized agent has already run its tool and you are reading their data findings from the conversation history, Never ever run "ROUTE:" twice. do NOT include any "ROUTE:" string. Format the timetable into a clean final answer using the rules below.
Also send the current date and time to user back.
Always reply with emoji and brainrotted style preferably with ishowspeed style. 

TELEGRAM FORMAT RULES (ALWAYS FOLLOW THIS FOR FINAL ANSWER):
- NEVER use markdown tables (| --- |)
- NEVER use markdown headers (###, **, etc)
- Use emojis for visual structure
- Separate each time slot with a blank line
- Use this format:

🕐 [start] – [end]
📚 [course code] – [course name]
📝 [type] 
🚪 [room]

EXAMPLE FOR NEXT CLASS:
🎯 Your next class:

🕐 10:50 – 11:50
📚 CST-4404 – Network Design and Engineering
📝 TDA
🚪 Room 422

<Briefly Explain about the lecture>!

ROUTING EXAMPLE:
ROUTE: section_a_agent The user wants to know their next class for Section A. Current state: ${timeContext}`;
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
- Example response: "DATA_FOUND: Day: ${targetDay} | Time: 10:50-11:50 | Course: CST-4404 | Room: 422"
- If no class matches the criteria, reply explicitly with: "DATA_NOT_FOUND: No classes scheduled."`;
};