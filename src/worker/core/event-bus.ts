// Event Bus — modules talk through events, never directly.
//
// Uses ctx.waitUntil() so the worker stays alive until delivery completes.

import { newId, now } from "./id";
import { queryAll, run } from "./db";
import type { Env } from "./db";
import type { RaymondEvent } from "../../shared/types";

export type EventHandler = (payload: unknown, event: RaymondEvent) => Promise<void>;

const handlers = new Map<string, EventHandler[]>();

let _ctx: ExecutionContext | null = null;
export function setExecutionContext(ctx: ExecutionContext): void {
  _ctx = ctx;
}

export const bus = {
  register(topic: string, handler: EventHandler): void {
    const list = handlers.get(topic) ?? [];
    list.push(handler);
    handlers.set(topic, list);
  },

  async publish(
    env: Env,
    topic: string,
    payload: unknown,
    source = "core"
  ): Promise<string> {
    const id = newId("evt");
    await run(
      env.DB,
      `INSERT INTO events (id, topic, payload, source, status, attempts, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, ?)`,
      id,
      topic,
      JSON.stringify(payload),
      source,
      now()
    );

    // Deliver inline — await so the worker doesn't shut down early.
    // In production this could be moved to a Queue for scale.
    await this.deliver(env, id);

    return id;
  },

  async deliver(env: Env, eventId: string): Promise<void> {
    const evt = await queryAll<RaymondEvent>(
      env.DB,
      `SELECT * FROM events WHERE id = ? LIMIT 1`,
      eventId
    );
    if (!evt.length) return;
    const event = evt[0];

    await run(
      env.DB,
      `UPDATE events SET status = 'processing', attempts = attempts + 1 WHERE id = ?`,
      event.id
    );

    const list = handlers.get(event.topic) ?? [];
    let ok = true;
    let lastError: string | undefined;

    for (const handler of list) {
      try {
        await handler(JSON.parse(event.payload), event);
      } catch (err) {
        ok = false;
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`Event handler failed for "${event.topic}":`, err);
      }
    }

    await run(
      env.DB,
      `UPDATE events 
       SET status = ?, error = ?, processed_at = ? 
       WHERE id = ?`,
      ok ? "delivered" : "failed",
      lastError ?? null,
      now(),
      event.id
    );
  },

  async retryFailed(env: Env, limit = 50): Promise<number> {
    const failed = await queryAll<RaymondEvent>(
      env.DB,
      `SELECT id FROM events 
       WHERE status = 'failed' AND attempts < 5 
       ORDER BY created_at ASC LIMIT ?`,
      limit
    );
    for (const row of failed) {
      await this.deliver(env, row.id);
    }
    return failed.length;
  },
};
