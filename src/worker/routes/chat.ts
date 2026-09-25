// Chat routes

import { Hono } from "hono";
import { newId, now } from "../core/id";
import { queryAll, run } from "../core/db";
import type { Env } from "../core/db";
import type { Conversation, Message } from "../../shared/types";
import { aiChatCapability } from "../capabilities/ai-chat";


// Safe waitUntil wrapper — handles cases where executionCtx is undefined
function safeWaitUntil(c: { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } }, promise: Promise<unknown>): void {
  const ctx = c?.executionCtx;
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(promise);
  } else {
    promise.catch((err) => console.error("bg task failed:", err));
  }
}

export const chatRoutes = new Hono<{ Bindings: Env }>();

chatRoutes.post("/conversations", async (c) => {
  const id = newId("conv");
  const title = "New chat";
  await run(
    c.env.DB,
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
    id, title, now(), now()
  );
  return c.json({ id, title, created_at: now(), updated_at: now() });
});

chatRoutes.get("/conversations", async (c) => {
  const rows = await queryAll<Conversation>(
    c.env.DB,
    "SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 100"
  );
  return c.json(rows);
});

chatRoutes.get("/conversations/:id/messages", async (c) => {
  const id = c.req.param("id");
  const rows = await queryAll<Message>(
    c.env.DB,
    "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    id
  );
  return c.json(rows);
});

chatRoutes.post("/conversations/:id/messages", async (c) => {
  const conversationId = c.req.param("id");
  const body = await c.req.json<{ content: string; provider?: string; model?: string }>();

  if (!body?.content?.trim()) {
    return c.json({ error: "content is required" }, 400);
  }

  console.log(`[chat] handling message for ${conversationId}, provider=${body.provider ?? "default"}`);

  // Run the AI chat handler directly (no event bus hop → same isolate)
  safeWaitUntil(c, 
    aiChatCapability.handle({
      conversation_id: conversationId,
      content: body.content,
      provider: body.provider,
      model: body.model,
    }).catch((err) => {
      console.error("[chat] handler error:", err);
    })
  );

  return c.json({ ok: true });
});

chatRoutes.delete("/conversations/:id", async (c) => {
  const id = c.req.param("id");
  await run(c.env.DB, "DELETE FROM conversations WHERE id = ?", id);
  return c.json({ ok: true });
});
