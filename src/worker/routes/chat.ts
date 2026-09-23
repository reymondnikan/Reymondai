// Chat routes

import { Hono } from "hono";
import { newId, now } from "../core/id";
import { bus } from "../core/event-bus";
import { queryAll, run } from "../core/db";
import type { Env } from "../core/db";
import type { Conversation, Message } from "../../shared/types";

export const chatRoutes = new Hono<{ Bindings: Env }>();

// Create a new conversation
chatRoutes.post("/conversations", async (c) => {
  const id = newId("conv");
  const title = "New chat";
  await run(
    c.env.DB,
    `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    id,
    title,
    now(),
    now()
  );
  return c.json({ id, title, created_at: now(), updated_at: now() });
});

// List conversations
chatRoutes.get("/conversations", async (c) => {
  const rows = await queryAll<Conversation>(
    c.env.DB,
    `SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 100`
  );
  return c.json(rows);
});

// Get messages of a conversation
chatRoutes.get("/conversations/:id/messages", async (c) => {
  const id = c.req.param("id");
  const rows = await queryAll<Message>(
    c.env.DB,
    `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
    id
  );
  return c.json(rows);
});

// Send a message
chatRoutes.post("/conversations/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json<{ content: string; provider?: string; model?: string }>();

  if (!body?.content?.trim()) {
    return c.json({ error: "content is required" }, 400);
  }

  await bus.publish(
    c.env,
    "chat.message.sent",
    {
      conversation_id: conversationId,
      content: body.content,
      provider: body.provider,
      model: body.model,
    },
    "api"
  );

  return c.json({ ok: true });
});

// Delete a conversation
chatRoutes.delete("/conversations/:id", async (c) => {
  const id = c.req.param("id");
  await run(c.env.DB, `DELETE FROM conversations WHERE id = ?`, id);
  return c.json({ ok: true });
});
