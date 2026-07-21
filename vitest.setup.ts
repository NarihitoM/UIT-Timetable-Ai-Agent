// ChatGroq throws synchronously if no API key is present, and it's instantiated
// at module-import time in src/Agent/telegram.model.ts — so tests need dummy
// values in place before any test module (even transitively) loads it.
process.env.SUBAPIKEY ??= "test-dummy-key";
process.env.BOT ??= "123456:test-token";
process.env.REDIS_URL ??= "redis://localhost:0";
process.env.DATABASE_URL ??= "postgresql://test";
