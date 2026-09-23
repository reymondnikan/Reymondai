// Raymond Worker entry point.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./core/db";
import { registry } from "./core/registry";
import { aiChatCapability, setEnv } from "./capabilities/ai-chat";
import { chatRoutes } from "./routes/chat";
import { systemRoutes } from "./routes/system";
import { authRoutes } from "./routes/auth";
import { initRuntime } from "./runtime";
import { requireAuth } from "./middleware/require-auth";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

// CORS — allow credentials for cookie-based auth
app.use("*", cors({
  origin: (origin) => origin, // reflect origin
  credentials: true,
}));

// Init runtime + set env per request
app.use("*", async (c, next) => {
  initRuntime(c.env);
  setEnv(c.env);
  await next();
});

// Public routes (no auth required)
app.route("/api/auth", authRoutes);

// Everything under /api/* else is auth-gated
app.use("/api/*", requireAuth());

// Protected routes
app.route("/api/chat", chatRoutes);
app.route("/api/system", systemRoutes);
app.get("/api", (c) => {
  return c.json({
    app: c.env.APP_NAME ?? "Raymond",
    version: "0.2.0",
  });
});

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

let bootstrapped = false;
async function bootstrap(env: Env): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  registry.register(aiChatCapability.manifest);
  aiChatCapability.register();
  try { await registry.syncToDb(env); } catch (err) { console.error("Registry sync failed:", err); }
}

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await bootstrap(env);
    initRuntime(env);
    setEnv(env);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
