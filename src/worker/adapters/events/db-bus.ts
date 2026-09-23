// Events implementation backed by D1 (events table).
//
// Publish -> persist -> deliver in-process. Future backends (Redis, NATS)
// can implement the same EventsContract without touching capabilities.

import type { EventsContract, EventHandler, EventMessage, StorageContract } from "../../core/contracts";

export class DbEventBus implements EventsContract {
  private handlers = new Map<string, EventHandler[]>();

  constructor(private storage: StorageContract) {}

  async publish(topic: string, payload: unknown, source = "core"): Promise<string> {
    const id = "evt_" + randomHex(16);
    await this.storage.execute(
      "INSERT INTO events (id, topic, payload, source, status, attempts, created_at) VALUES (?, ?, ?, ?, 'pending', 0, ?)",
      [id, topic, JSON.stringify(payload), source, Date.now()]
    );
    await this.deliver(id);
    return id;
  }

  subscribe(topic: string, handler: EventHandler): void {
    const list = this.handlers.get(topic) ?? [];
    list.push(handler);
    this.handlers.set(topic, list);
  }

  unsubscribe(topic: string, handler: EventHandler): void {
    const list = this.handlers.get(topic) ?? [];
    const idx = list.indexOf(handler);
    if (idx >= 0) list.splice(idx, 1);
  }

  async retryFailed(limit = 50): Promise<number> {
    const rows = await this.storage.query<{ id: string }>(
      "SELECT id FROM events WHERE status = 'failed' AND attempts < 5 ORDER BY created_at ASC LIMIT ?",
      [limit]
    );
    for (const r of rows) await this.deliver(r.id);
    return rows.length;
  }

  private async deliver(id: string): Promise<void> {
    const row = await this.storage.queryOne<{
      id: string;
      topic: string;
      payload: string;
      source: string | null;
      created_at: number;
    }>(
      "SELECT id, topic, payload, source, created_at FROM events WHERE id = ? LIMIT 1",
      [id]
    );
    if (!row) return;

    await this.storage.execute(
      "UPDATE events SET status = 'processing', attempts = attempts + 1 WHERE id = ?",
      [id]
    );

    const handlers = this.handlers.get(row.topic) ?? [];
    const message: EventMessage = {
      id: row.id,
      topic: row.topic,
      payload: safeJsonParse(row.payload),
      source: row.source ?? undefined,
      createdAt: row.created_at,
    };

    let ok = true;
    let lastError: string | undefined;
    for (const h of handlers) {
      try {
        await h(message);
      } catch (err) {
        ok = false;
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`Event handler failed for "${row.topic}":`, err);
      }
    }

    await this.storage.execute(
      "UPDATE events SET status = ?, error = ?, processed_at = ? WHERE id = ?",
      [ok ? "delivered" : "failed", lastError ?? null, Date.now(), id]
    );
  }
}

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}
