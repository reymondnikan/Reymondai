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
import { telegramWsRoutes } from "./routes/telegram-ws";
import { nodeRoutes } from "./routes/node";
import { nodeApiRoutes } from "./routes/node-api";
import { xrayRoutes } from "./routes/xray";
import { botWebhookRoutes } from "./routes/bot-webhook";
import { shopRoutes } from "./routes/shop";
import { nodesCrudRoutes } from "./routes/nodes-crud";
import { nodesRoutes } from "./routes/nodes";
import { initRuntime } from "./runtime";
import { requireAuth } from "./middleware/require-auth";

export { TelegramProxy } from "./do/telegram-proxy";
export { NodeAgent } from "./do/node-agent";

type Bindings = Env;
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: (origin) => origin, credentials: true }));

app.use("*", async (c, next) => {
  await next();
  const path = new URL(c.req.url).pathname;
  if (path === "/" || path.endsWith(".html") || path.endsWith(".js") || path.endsWith(".css")) {
    c.res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  }
});

app.route("/tg", telegramWsRoutes);

// ===== Bot webhook (NO auth â€” Telegram calls it) =====
app.route("/api/bot", botWebhookRoutes);
app.route("/node", nodeRoutes);
app.route("/api/auth", authRoutes);

// Auth middleware for /api/* (except /api/auth which is already mounted)
app.use("/api/*", requireAuth());

app.route("/api/chat", chatRoutes);
app.route("/api/system", systemRoutes);
app.route("/api/telegram", telegramRoutes);
app.route("/api/nodes", nodeApiRoutes);
app.route("/api/nodes-crud", nodesCrudRoutes);
app.route("/api/xray", xrayRoutes);
app.route("/api/shop", shopRoutes);
app.route("/api/nodes-list", nodesRoutes);

app.get("/api", (c) => c.json({ app: c.env.APP_NAME ?? "Raymond", version: "0.5.0" }));
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

// ===== BOOTSTRAP =====
// Critical: init runtime FIRST, then register capabilities.

let bootstrapped = false;

function bootstrap(env: Env, ctx: ExecutionContext): void {
  if (bootstrapped) return;
  bootstrapped = true;

  console.log("[bootstrap] initializing runtime");
  initRuntime(env);
  setEnv(env);

  console.log("[bootstrap] registering capabilities");
  registry.register(aiChatCapability.manifest);
  aiChatCapability.register();
  console.log("[bootstrap] ai-chat registered");

  ctx.waitUntil(
    registry.syncToDb(env).catch((err) => console.error("Registry sync failed:", err))
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    bootstrap(env, ctx);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
