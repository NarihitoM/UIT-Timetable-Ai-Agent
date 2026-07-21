import app from "./index.ts";

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`Dev server listening on http://localhost:${port}`));
