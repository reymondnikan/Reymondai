// Raymond Worker entry point.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./core/db";
import { registry } from "./core/registry";
import { aiChatCapability, setEnv } from "./capabilities/ai-chat";
import { chatRoutes } from "./routes/chat";
import { systemRoutes } from "./routes/system";

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use("*", cors());

// Attach env globally per request
app.use("*", async (c, next) => {
  setEnv(c.env);
  await next();
});

// Routes
app.route("/api/chat", chatRoutes);
app.route("/api/system", systemRoutes);

// Root API info
app.get("/api", (c) => {
  return c.json({
    app: c.env.APP_NAME ?? "Raymond",
    version: "0.1.0",
    endpoints: [
      "GET  /api/system/health",
      "GET  /api/system/providers",
      "GET  /api/system/capabilities",
      "GET  /api/system/operations",
      "GET  /api/chat/conversations",
      "POST /api/chat/conversations",
      "GET  /api/chat/conversations/:id/messages",
      "POST /api/chat/conversations/:id/messages",
      "DEL  /api/chat/conversations/:id",
    ],
  });
});

// 404 for unknown API routes
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// One-time registration of capabilities + registry sync
let bootstrapped = false;
async function bootstrap(env: Env): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  registry.register(aiChatCapability.manifest);
  aiChatCapability.register();

  try {
    await registry.syncToDb(env);
  } catch (err) {
    console.error("Registry sync failed:", err);
  }
}

// Static assets handler (SPA fallback)
app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await bootstrap(env);
    setEnv(env);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
