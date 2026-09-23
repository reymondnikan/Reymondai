// Telegram HTTP routes.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { telegramCapability } from "../capabilities/telegram/capability";

export const telegramRoutes = new Hono<{ Bindings: Env }>();

// GET /api/telegram/accounts
telegramRoutes.get("/accounts", async (c) => {
  try {
    const accounts = await telegramCapability.listAccounts();
    return c.json(accounts);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// GET /api/telegram/chats?sessionId=...
telegramRoutes.get("/chats", async (c) => {
  const sessionId = c.req.query("sessionId");
  if (!sessionId) return c.json({ error: "sessionId required" }, 400);
  try {
    return c.json(await telegramCapability.listChats(sessionId));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// GET /api/telegram/messages?sessionId=...&chatId=...
telegramRoutes.get("/messages", async (c) => {
  const sessionId = c.req.query("sessionId");
  const chatId = c.req.query("chatId");
  if (!sessionId || !chatId) {
    return c.json({ error: "sessionId and chatId required" }, 400);
  }
  try {
    return c.json(await telegramCapability.listMessages(sessionId, chatId));
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// POST /api/telegram/messages  { sessionId, chatId, text }
telegramRoutes.post("/messages", async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    chatId: string;
    text: string;
  }>();
  try {
    const msg = await telegramCapability.sendMessage(
      body.sessionId,
      body.chatId,
      body.text
    );
    return c.json(msg);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// DELETE /api/telegram/chats/:chatId?sessionId=...
telegramRoutes.delete("/chats/:chatId", async (c) => {
  const sessionId = c.req.query("sessionId");
  const chatId = c.req.param("chatId");
  if (!sessionId) return c.json({ error: "sessionId required" }, 400);
  try {
    await telegramCapability.deleteChat(sessionId, chatId);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});
