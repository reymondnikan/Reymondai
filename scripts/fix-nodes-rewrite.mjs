import fs from "node:fs";

const content = `// Multi-Node management API.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { queryAll, queryFirst, run } from "../core/db";

export const nodesRoutes = new Hono<{ Bindings: Env }>();

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// List nodes handler
const listHandler = async (c: any) => {
  const nodes = await queryAll(
    c.env.DB,
    "SELECT id, name, display_name, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at FROM nodes ORDER BY sort_order ASC, created_at ASC"
  );
  return c.json({ ok: true, nodes });
};

// List nodes (accept both "" and "/")
nodesRoutes.get("", listHandler);
nodesRoutes.get("/", listHandler);

// Get single node
nodesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const node = await queryFirst(
    c.env.DB,
    "SELECT * FROM nodes WHERE id = ? LIMIT 1",
    id
  );
  if (!node) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({ ok: true, node });
});

// Create node (accept both "" and "/")
const createHandler = async (c: any) => {
  const body = await c.req.json<{
    name?: string;
    display_name?: string;
    ip?: string;
    port?: number;
    sni?: string;
    public_key?: string;
    short_id?: string;
    location?: string;
  }>();

  const name = body.name?.trim();
  const ip = body.ip?.trim();
  if (!name) return c.json({ ok: false, error: "name required" }, 400);
  if (!ip) return c.json({ ok: false, error: "ip required" }, 400);

  const id = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const existing = await queryFirst(c.env.DB, "SELECT id FROM nodes WHERE id = ? LIMIT 1", id);
  if (existing) return c.json({ ok: false, error: "node id already exists" }, 409);

  const now = Date.now();
  await run(
    c.env.DB,
    "INSERT INTO nodes (id, name, display_name, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 100, ?, ?)",
    id,
    name,
    body.display_name ?? name,
    ip,
    Math.max(1, Math.min(65535, Math.floor(body.port ?? 443))),
    body.sni ?? "www.cloudflare.com",
    body.public_key ?? null,
    body.short_id ?? null,
    body.location ?? null,
    now,
    now
  );

  return c.json({ ok: true, id });
};

nodesRoutes.post("", createHandler);
nodesRoutes.post("/", createHandler);

// Update node
nodesRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    display_name?: string;
    ip?: string;
    port?: number;
    sni?: string;
    public_key?: string;
    short_id?: string;
    location?: string;
    enabled?: boolean;
    sort_order?: number;
  }>();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name.trim()); }
  if (body.display_name !== undefined) { fields.push("display_name = ?"); params.push(body.display_name); }
  if (body.ip !== undefined) { fields.push("ip = ?"); params.push(body.ip.trim()); }
  if (body.port !== undefined) { fields.push("port = ?"); params.push(Math.floor(body.port)); }
  if (body.sni !== undefined) { fields.push("sni = ?"); params.push(body.sni); }
  if (body.public_key !== undefined) { fields.push("public_key = ?"); params.push(body.public_key); }
  if (body.short_id !== undefined) { fields.push("short_id = ?"); params.push(body.short_id); }
  if (body.location !== undefined) { fields.push("location = ?"); params.push(body.location); }
  if (body.enabled !== undefined) { fields.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }
  if (body.sort_order !== undefined) { fields.push("sort_order = ?"); params.push(Math.floor(body.sort_order)); }

  if (fields.length === 0) return c.json({ ok: false, error: "nothing to update" }, 400);

  fields.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  await run(c.env.DB, "UPDATE nodes SET " + fields.join(", ") + " WHERE id = ?", ...params);
  return c.json({ ok: true });
});

// Delete node
nodesRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const userCount = await queryFirst<{ c: number }>(
    c.env.DB,
    "SELECT COUNT(*) as c FROM xray_users WHERE node_id = ?",
    id
  );
  if ((userCount?.c ?? 0) > 0) {
    return c.json(
      { ok: false, error: "این سرور " + userCount?.c + " کاربر فعال دارد. اول کاربران را منتقل یا حذف کنید." },
      400
    );
  }

  await run(c.env.DB, "DELETE FROM nodes WHERE id = ?", id);
  return c.json({ ok: true });
});
`;

fs.writeFileSync("src/worker/routes/nodes.ts", content, "utf-8");
console.log("nodes.ts rewritten:", content.length, "bytes");
