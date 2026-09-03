# Telegram UIT Timetable Bot
This is an telegram bot that can automatic detect the current time and respond which session is going to be next.
Built Type: MultiAgent System Mode.
 
# Stacks
- Telegram
- Groq
- Langgraph
- redis
- Postgres (Neon) via Prisma

# Webhook Setup

The bot runs on webhooks, not polling. Every route is served by `dist/index.js`, and the
handler is mounted at `/webhook`, so the URL you register is:

```
https://<your-deployment>.vercel.app/webhook
```

## 1. Deploy first

Set these in Vercel before registering the webhook, otherwise the first update fails:

| Variable | Purpose |
|----------|---------|
| `BOT` | Telegram bot token from @BotFather |
| `APIKEY` / `SUBAPIKEY` | Groq keys for the supervisor and section agents |
| `REDIS_URL` | Rate limit and update dedupe |
| `DATABASE_URL` | Neon Postgres, stores chat memory |
| `CHANNEL` | Channel id, only used by the paid-mode check |

Run `npx prisma db push` once against `DATABASE_URL` so the `Chat` table exists.

## 2. Register the webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://<your-deployment>.vercel.app/webhook" \
  -d "allowed_updates=[\"message\",\"channel_post\"]" \
  -d "drop_pending_updates=true"
```

`allowed_updates` keeps Telegram from sending edits and reactions the handler ignores anyway.
`drop_pending_updates` clears anything queued from a previous deployment.

Expected reply:

```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## 3. Verify

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

`pending_update_count` should be 0 and `last_error_message` absent. If it shows
`Wrong response from the webhook: 500`, check the Vercel function logs, not Telegram.

## 4. Local development

Telegram only calls public HTTPS URLs, so tunnel the dev server:

```bash
npm run dev
npx untun@latest tunnel http://localhost:3000
```

Point `setWebhook` at the tunnel URL plus `/webhook`. Only one webhook can be registered
per bot, so use a second bot from @BotFather for local work instead of stealing the
production one.

## Removing the webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

