// Event Bus — modules communicate through events.
//
// Persistent (D1) + in-process delivery.

import { newId, now } from "./id";
import { queryAll, run } from "./db";
import type { Env } from "./db";
import type { RaymondEvent } from "../../shared/types";

export type EventHandler = (payload: unknown, event: RaymondEvent) => Promise<void>;

const handlers = new Map<string, EventHandler[]>();

export const bus = {
  register(topic: string, handler: EventHandler): void {
    const list = handlers.get(topic) ?? [];
    list.push(handler);
    handlers.set(topic, list);
    console.log(`[bus] registered handler for "${topic}" (total: ${list.length})`);
  },

  listTopics(): string[] {
    return Array.from(handlers.keys());
  },

  async publish(
    env: Env,
    topic: string,
    payload: unknown,
    source = "core"
  ): Promise<string> {
    const id = newId("evt");
    const subs = handlers.get(topic)?.length ?? 0;
    console.log(`[bus] publish "${topic}" (subs: ${subs})`);

    await run(
      env.DB,
      "INSERT INTO events (id, topic, payload, source, status, attempts, created_at) VALUES (?, ?, ?, ?, 'pending', 0, ?)",
      id,
      topic,
      JSON.stringify(payload),
      source,
      now()
    );

    await this.deliver(env, id);
    return id;
  },

  async deliver(env: Env, eventId: string): Promise<void> {
    const evt = await queryAll<RaymondEvent>(
      env.DB,
      "SELECT * FROM events WHERE id = ? LIMIT 1",
      eventId
    );
    if (!evt.length) return;
    const event = evt[0];

    await run(
      env.DB,
      "UPDATE events SET status = 'processing', attempts = attempts + 1 WHERE id = ?",
      event.id
    );

    const list = handlers.get(event.topic) ?? [];
    console.log(`[bus] deliver "${event.topic}" to ${list.length} handlers`);

    let ok = true;
    let lastError: string | undefined;
    for (const handler of list) {
      try {
        await handler(JSON.parse(event.payload), event);
      } catch (err) {
        ok = false;
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`[bus] handler failed for "${event.topic}":`, err);
      }
    }

    await run(
      env.DB,
      "UPDATE events SET status = ?, error = ?, processed_at = ? WHERE id = ?",
      ok ? "delivered" : "failed",
      lastError ?? null,
      now(),
      event.id
    );
  },
};
