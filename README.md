<p align="center">
  <img src="src/assets/img/UIT.jpg" alt="University of Information Technology logo" width="140">
</p>

<h1 align="center">Telegram UIT Timetable Bot</h1>

A Telegram bot that answers timetable questions for UIT students. Send it your section
command and it reads the current date and time, looks at that section's timetable, and
tells you which class is next instead of making you decode a grid.

Built as a multi agent system: a supervisor routes the message to one of 21 agents,
one per section plus a room agent, and only that agent sees its own timetable.

# Stacks
- Telegram Bot API (webhook, no polling)
- Groq
- LangGraph
- Redis
- Postgres (Neon) via Prisma
- Express on Vercel serverless

# Scope

What it does:
- Answers "what is my next class" for 20 sections across semesters 2, 4, 6 and 8
- Finds currently available rooms with `/room`
- Remembers the last few turns per chat, so follow up questions work
- Works in private chats, groups and channels
- Rate limits each chat to one agent request every 15 seconds

What it does not do:
- Edit or upload timetables. The data is plain text in `src/data/`, changed by commit
- Notify or remind you. It only answers when asked
- Handle photos, voice or documents. Text commands only

# Architecture

```
Telegram → /webhook → controller → supervisor → section agent → answer
                          │            │
                          │            └─ picks one route from the message text
                          │
                          ├─ redis: dedupes updates, rate limits per chat
                          └─ postgres: last 6 turns of chat memory
```

The supervisor does not call a model. It matches the command with a regex and returns a
route, so a wrong section is a routing bug rather than a hallucination. Each section
agent gets only its own timetable file in the system prompt.

# Folder Structure

```
.
├── prisma/
│   ├── migrations/                     # Generated migration history
│   └── schema/
│       ├── chat.prisma                 # Chat model, one row per message
│       └── main.prisma                 # Generator and datasource
├── src/
│   ├── Agent/
│   │   ├── telegram.model.ts           # Groq model instances
│   │   ├── telegram.state.ts           # LangGraph state annotation
│   │   └── telegram.workflow.ts        # Supervisor, section agents, room agent, edges
│   ├── config/
│   │   └── env.ts                      # Loads .env
│   ├── data/                           # Timetable text files, one per section
│   ├── lib/
│   │   ├── memory.ts                   # Loads and saves chat history
│   │   ├── prisma.ts                   # Prisma client
│   │   ├── redis.ts                    # Redis client
│   │   └── telegram.ts                 # Bot instance
│   ├── modules/
│   │   ├── telegram.command.ts         # Command list
│   │   ├── telegram.controller.ts      # Webhook handler, dedupe, rate limit
│   │   └── telegram.route.ts           # Route definition
│   ├── prompt/
│   │   └── systemprompt.ts             # Section and room agent prompts
│   ├── shared/middlewares/
│   │   └── telegramchannel.middleware.ts
│   ├── constants.ts                    # Section registry, single source of truth
│   ├── dev-server.ts                   # Local listener
│   └── index.ts                        # Express app, exported for serverless
└── vercel.json
```

Adding a section means adding one entry to `SECTIONS` in `src/constants.ts` and dropping
the matching file in `src/data/`. The command, the route and the agent node are all
derived from that entry.

# Commands

| Command | What it does |
|---------|--------------|
| `/start` | Intro message |
| `/help` | Lists every section command |
| `/contributors` | Credits |
| `/sourcecode` | Link to this repo |
| `/sem2_a` … `/sem8_bis` | Timetable for that section |
| `/room` | Currently available rooms |

# Development

```bash
npm install
npx prisma generate
npm run dev          # local server on :3000
npm test             # vitest
npm run typecheck
```

Copy `.env.example` to `.env` and fill it in. See `.env.example` for the full list.
