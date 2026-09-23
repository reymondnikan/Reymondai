// Raymond Worker entry point.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./core/db";
import { registry } from "./core/registry";
import { aiChatCapability, setEnv } from "./capabilities/ai-chat";
import { chatRoutes } from "./routes/chat";
import { systemRoutes } from "./routes/system";
import { authRoutes } from "./routes/auth";
import { telegramRoutes } from "./routes/telegram";
import { initRuntime } from "./runtime";
import { requireAuth } from "./middleware/require-auth";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

// CORS أ¢â‚¬â€‌ allow credentials for cookie-based auth
app.use("*", cors({
  origin: (origin) => origin, // reflect origin
  credentials: true,
}));

// Disable caching for HTML/JS/CSS so updates show immediately
app.use("*", async (c, next) => {
  await next();
  const path = new URL(c.req.url).pathname;
  if (path === "/" || path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css")) {
    c.res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    c.res.headers.set("Pragma", "no-cache");
    c.res.headers.set("Expires", "0");
  }
});

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
app.route("/api/telegram", telegramRoutes);
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
