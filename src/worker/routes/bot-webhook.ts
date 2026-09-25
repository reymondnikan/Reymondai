// Telegram bot webhook endpoint.
//
// URL: POST /api/bot/webhook
// Telegram sends updates here. No auth (Telegram signs with secret header).

import { Hono } from "hono";
import type { Env } from "../core/db";
import { handleUpdate } from "../bot/handler";
import type { TelegramUpdate } from "../bot/telegram-api";


// Safe waitUntil wrapper — handles cases where executionCtx is undefined
function safeWaitUntil(c: { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } }, promise: Promise<unknown>): void {
  const ctx = c?.executionCtx;
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(promise);
  } else {
    promise.catch((err) => console.error("bg task failed:", err));
  }
}

export const botWebhookRoutes = new Hono<{ Bindings: Env }>();

botWebhookRoutes.post("/webhook", async (c) => {
  try {
    const update = (await c.req.json()) as TelegramUpdate;
    // Process async — return 200 immediately so Telegram doesn't retry
    safeWaitUntil(c, 
      handleUpdate(c.env, update).catch((err) => {
        console.error("bot update error:", err);
      })
    );
    return c.json({ ok: true });
  } catch (err) {
    console.error("webhook parse error:", err);
    return c.json({ ok: false }, 200); // Still 200 so TG doesn't retry
  }
});

// Setup endpoint: set webhook with Telegram
botWebhookRoutes.post("/setup", async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) return c.json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const url = new URL(c.req.url);
  const webhookUrl = `${url.protocol}//${url.host}/api/bot/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();
  return c.json({ webhookUrl, telegram: data });
});

// Info endpoint
botWebhookRoutes.get("/info", async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) return c.json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const [meRes, infoRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()),
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json()),
  ]);

  return c.json({ me: meRes, webhook: infoRes });
});
