// AI Chat capability — base capability for v0.1.
//
// Subscribes to: chat.message.sent
// Publishes:     chat.message.received

import { newId, now } from "../core/id";
import { bus } from "../core/event-bus";
import { audit } from "../core/audit";
import { queryAll, run } from "../core/db";
import type { Env } from "../core/db";
import type { Message } from "../../shared/types";
import { aiRouter } from "../adapters/ai-router";

export interface ChatMessagePayload {
  conversation_id: string;
  content: string;
  provider?: string;
  model?: string;
}

// We capture env at request time via a module-level holder set by the worker.
let _env: Env | null = null;
export function setEnv(env: Env): void { _env = env; }
export function getEnv(): Env | null { return _env; }

export const aiChatCapability = {
  manifest: {
    id: "ai-chat",
    name: "AI Chat",
    version: "0.1.0",
    description: "Chat with AI through the Router",
    events_subscribed: ["chat.message.sent"],
    events_published: ["chat.message.received"],
  },

  register(): void {
    bus.register("chat.message.sent", async (payload) => {
      const p = payload as ChatMessagePayload;
      await this.handle(p);
    });
  },

  async handle(payload: ChatMessagePayload): Promise<void> {
    const env = getEnv();
    if (!env) {
      console.error("ai-chat: env not set");
      return;
    }

    const { conversation_id, content, provider, model } = payload;

    // 1. Store user message
    const userMsgId = newId("msg");
    await run(
      env.DB,
      `INSERT INTO messages (id, conversation_id, role, content, created_at)
       VALUES (?, ?, 'user', ?, ?)`,
      userMsgId,
      conversation_id,
      content,
      now()
    );

    // 2. Load history
    const history = await queryAll<Message>(
      env.DB,
      `SELECT role, content FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC LIMIT 40`,
      conversation_id
    );

    // 3. Route to AI
    const started = now();
    let result: { content: string; provider: string; model: string };
    try {
      result = await aiRouter.complete(env, {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        provider,
        model,
      });
    } catch (err) {
      console.error("ai-chat: AI call failed:", err);
      // Store an error message so the UI sees something
      await run(
        env.DB,
        `INSERT INTO messages 
          (id, conversation_id, role, content, provider, created_at)
         VALUES (?, ?, 'assistant', ?, 'error', ?)`,
        newId("msg"),
        conversation_id,
        `[AI error] ${err instanceof Error ? err.message : String(err)}`,
        now()
      );
      return;
    }
    const latency = now() - started;

    // 4. Store assistant reply
    const assistantId = newId("msg");
    await run(
      env.DB,
      `INSERT INTO messages 
        (id, conversation_id, role, content, provider, model, latency_ms, created_at)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)`,
      assistantId,
      conversation_id,
      result.content,
      result.provider,
      result.model,
      latency,
      now()
    );

    // 5. Bump conversation updated_at
    await run(
      env.DB,
      `UPDATE conversations SET updated_at = ? WHERE id = ?`,
      now(),
      conversation_id
    );

    // 6. Audit
    await audit(env, {
      actor: "owner",
      action: "chat.message",
      resource_type: "conversation",
      resource_id: conversation_id,
      metadata: { provider: result.provider, model: result.model, latency_ms: latency },
    });

    // 7. Publish event
    await bus.publish(
      env,
      "chat.message.received",
      { conversation_id, message_id: assistantId },
      "ai-chat"
    );
  },
};
