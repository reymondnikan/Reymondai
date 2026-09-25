// Node CRUD API — manage VPS nodes from the panel.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { queryAll, queryFirst, run } from "../core/db";
import { NodeClient } from "../adapters/ai/node-client";

export const nodesCrudRoutes = new Hono<{ Bindings: Env }>();

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// List all nodes with connection status
nodesCrudRoutes.get("/", async (c) => {
  const nodes = await queryAll<{
    id: string;
    name: string;
    display_name: string;
    flag: string;
    ip: string;
    port: number;
    sni: string;
    public_key: string;
    short_id: string;
    location: string;
    enabled: number;
    sort_order: number;
    created_at: number;
  }>(
    c.env.DB,
    "SELECT id, name, display_name, flag, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at FROM nodes ORDER BY sort_order ASC, created_at ASC"
  );

  // Get live status for each node (in parallel)
  const withStatus = await Promise.all(
    nodes.map(async (n) => {
      let connected = false;
      try {
        const cli = new NodeClient(c.env, n.id);
        const status = await cli.status();
        connected = status.connected;
      } catch {}
      return {
        ...n,
        enabled: n.enabled === 1,
        connected,
      };
    })
  );

  return c.json({ ok: true, nodes: withStatus });
});

// Get one node
nodesCrudRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const node = await queryFirst(
    c.env.DB,
    "SELECT * FROM nodes WHERE id = ? LIMIT 1",
    id
  );
  if (!node) return c.json({ ok: false, error: "not found" }, 404);

  let connected = false;
  try {
    const cli = new NodeClient(c.env, id);
    const status = await cli.status();
    connected = status.connected;
  } catch {}

  return c.json({ ok: true, node: { ...node, connected } });
});

// Add new node
nodesCrudRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    id?: string;
    name?: string;
    display_name?: string;
    flag?: string;
    ip?: string;
    port?: number;
    sni?: string;
    public_key?: string;
    short_id?: string;
    location?: string;
  }>();

  if (!body.id || !body.name || !body.ip || !body.public_key || !body.short_id) {
    return c.json({ ok: false, error: "id, name, ip, public_key, short_id required" }, 400);
  }

  const existing = await queryFirst(
    c.env.DB,
    "SELECT id FROM nodes WHERE id = ? LIMIT 1",
    body.id
  );
  if (existing) return c.json({ ok: false, error: "id already exists" }, 409);

  const now = Date.now();
  await run(
    c.env.DB,
    `INSERT INTO nodes (id, name, display_name, flag, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 100, ?, ?)`,
    body.id,
    body.name,
    body.display_name ?? body.name,
    body.flag ?? "",
    body.ip,
    body.port ?? 443,
    body.sni ?? "www.cloudflare.com",
    body.public_key,
    body.short_id,
    body.location ?? "",
    now,
    now
  );

  return c.json({ ok: true, id: body.id });
});

// Update node
nodesCrudRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const allowed = ["name", "display_name", "flag", "ip", "port", "sni", "public_key", "short_id", "location", "enabled", "sort_order"];
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(key + " = ?");
      params.push(key === "enabled" ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (fields.length === 0) return c.json({ ok: false, error: "nothing to update" }, 400);

  fields.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  await run(c.env.DB, `UPDATE nodes SET ${fields.join(", ")} WHERE id = ?`, ...params);
  return c.json({ ok: true });
});

// Delete node
nodesCrudRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Check if any xray_users are on this node
  const usersOnNode = await queryFirst<{ c: number }>(
    c.env.DB,
    "SELECT COUNT(*) as c FROM xray_users WHERE node_id = ?",
    id
  );

  if (usersOnNode && usersOnNode.c > 0) {
    return c.json({
      ok: false,
      error: `Cannot delete: ${usersOnNode.c} users still on this node. Migrate or delete them first.`,
    }, 400);
  }

  await run(c.env.DB, "DELETE FROM nodes WHERE id = ?", id);
  return c.json({ ok: true });
});

// Test connection
nodesCrudRoutes.post("/:id/test", async (c) => {
  const id = c.req.param("id");
  try {
    const cli = new NodeClient(c.env, id);
    const status = await cli.status();
    if (!status.connected) {
      return c.json({ ok: false, error: "Node not connected" });
    }
    const ping = await cli.task("ping", {}, 10000);
    return c.json({ ok: true, ping });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message });
  }
});

// ============================================================
// Get live metrics for a node
// ============================================================
nodesCrudRoutes.get("/:id/metrics", async (c) => {
  const id = c.req.param("id");
  try {
    const cli = new NodeClient(c.env, id);
    const r = await cli.task<Record<string, unknown>>("system.metrics", {}, 15000);
    if (!r.ok || !r.output) {
      return c.json({ ok: false, error: r.error ?? "metrics failed" }, 500);
    }
    return c.json({ ok: true, metrics: r.output });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});

// ============================================================
// Get metrics for ALL nodes
// ============================================================
nodesCrudRoutes.get("/metrics/all", async (c) => {
  const nodes = await queryAll<{ id: string; display_name: string; flag: string; ip: string }>(
    c.env.DB,
    "SELECT id, display_name, flag, ip FROM nodes WHERE enabled = 1 ORDER BY sort_order ASC"
  );

  const results = await Promise.all(
    nodes.map(async (n) => {
      try {
        const cli = new NodeClient(c.env, n.id);
        const r = await cli.task<Record<string, unknown>>("system.metrics", {}, 15000);
        return {
          id: n.id,
          display_name: n.display_name,
          flag: n.flag,
          ip: n.ip,
          ok: r.ok,
          metrics: r.output ?? null,
          error: r.error ?? null,
        };
      } catch (e) {
        return {
          id: n.id,
          display_name: n.display_name,
          flag: n.flag,
          ip: n.ip,
          ok: false,
          metrics: null,
          error: (e as Error).message,
        };
      }
    })
  );

  return c.json({ ok: true, nodes: results });
});
