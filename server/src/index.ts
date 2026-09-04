import { Hono } from "hono";
import { api } from "./routes/api";

export const app = new Hono();

app.route("/api", api);

app.get("/health", (c) => c.json({ ok: true, service: "fitness-everybody-edgespark" }));

export default app;
