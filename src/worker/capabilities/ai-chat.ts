// AI Chat capability — uses the runtime AI registry.

import { newId, now } from "../core/id";
import { audit } from "../core/audit";
import { queryAll, run } from "../core/db";
import type { Env } from "../core/db";
import type { Message } from "../../shared/types";
import { getAI, getEvents } from "../runtime";

export interface ChatMessagePayload {
  conversation_id: string;
  content: string;
  provider?: string;
  model?: string;
}

let _env: Env | null = null;
export function setEnv(env: Env): void { _env = env; }
export function getEnv(): Env | null { return _env; }

export const aiChatCapability = {
  manifest: {
    id: "ai-chat",
    name: "AI Chat",
    version: "0.2.0",
    description: "Chat with AI through the Router",
    events_subscribed: ["chat.message.sent"],
    events_published: ["chat.message.received"],
  },

  register(): void {
    const events = getEvents();
    if (!events) {
      // Fallback: register via legacy bus on next tick
      setTimeout(() => {
        const e = getEvents();
        if (e) e.subscribe("chat.message.sent", (m) => aiChatCapability.handle(m.payload as ChatMessagePayload));
      }, 0);
      return;
    }
    events.subscribe("chat.message.sent", (m) =>
      aiChatCapability.handle(m.payload as ChatMessagePayload)
    );
  },

  async handle(payload: ChatMessagePayload): Promise<void> {
    const env = _env;
    if (!env) return;

    const { conversation_id, content, provider, model } = payload;

    // 1. Store user message
    await run(
      env.DB,
      "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
      newId("msg"),
      conversation_id,
      content,
      now()
    );

    // 2. Load history
    const history = await queryAll<Message>(
      env.DB,
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 40",
      conversation_id
    );

    // 3. Call AI
    const started = now();
    let result: { content: string; provider: string; model: string };
    try {
      const ai = getAI();
      if (!ai) throw new Error("AI registry not ready");
      result = await ai.complete(
        {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          model,
        },
        provider
      );
    } catch (err) {
      console.error("ai-chat failed:", err);
      await run(
        env.DB,
        "INSERT INTO messages (id, conversation_id, role, content, provider, created_at) VALUES (?, ?, 'assistant', ?, 'error', ?)",
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
      "INSERT INTO messages (id, conversation_id, role, content, provider, model, latency_ms, created_at) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?)",
      assistantId,
      conversation_id,
      result.content,
      result.provider,
      result.model,
      latency,
      now()
    );

    await run(
      env.DB,
      "UPDATE conversations SET updated_at = ? WHERE id = ?",
      now(),
      conversation_id
    );

    await audit(env, {
      actor: "owner",
      action: "chat.message",
      resource_type: "conversation",
      resource_id: conversation_id,
      metadata: { provider: result.provider, model: result.model, latency_ms: latency },
    });

    const events = getEvents();
    if (events) {
      await events.publish(
        "chat.message.received",
        { conversation_id, message_id: assistantId },
        "ai-chat"
      );
    }
  },
};
