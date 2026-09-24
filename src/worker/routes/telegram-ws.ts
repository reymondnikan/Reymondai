// Telegram WebSocket relay route.
//
// Browser (GramJS) opens:  wss://raymond.../tg/apiws?dc=2
// This Worker forwards to the TelegramProxy Durable Object,
// which relays frames to Telegram's datacenter.

import { Hono } from "hono";
import type { Env } from "../core/db";

export const telegramWsRoutes = new Hono<{ Bindings: Env }>();

telegramWsRoutes.get("/apiws", async (c) => {
  const upgrade = c.req.header("Upgrade");
  if (upgrade !== "websocket") {
    return c.text("Expected WebSocket upgrade", 426);
  }

  const dc = c.req.query("dc") ?? "2";
  // Route to a stable DO per datacenter
  const id = c.env.TELEGRAM_PROXY.idFromName(`dc-${dc}`);
  const stub = c.env.TELEGRAM_PROXY.get(id);
  return stub.fetch(c.req.raw);
});
