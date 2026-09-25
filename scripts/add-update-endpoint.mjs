import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes('xrayRoutes.put("/users/:name"')) {
  console.log("PUT endpoint already exists");
  process.exit(0);
}

// Find a good insertion point - before the DELETE endpoint
const deleteMarker = 'xrayRoutes.delete("/users/:name"';
const idx = c.indexOf(deleteMarker);

if (idx === -1) {
  console.log("DELETE endpoint not found");
  process.exit(1);
}

const updateEndpoint = `xrayRoutes.put("/users/:name", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json<{
    quota_gb?: number;
    speed_mbps?: number;
    duration_days?: number;
    max_connections?: number;
    enabled?: boolean;
  }>();

  const existing = await queryFirst<{
    id: string;
    name: string;
    uuid: string;
    created_at: number;
    quota_gb: number;
    speed_mbps: number;
    duration_days: number;
    max_connections: number;
    enabled: number;
  }>(
    c.env.DB,
    "SELECT id, name, uuid, created_at, quota_gb, speed_mbps, duration_days, max_connections, enabled FROM xray_users WHERE name = ? LIMIT 1",
    name
  );
  if (!existing) return c.json({ ok: false, error: "not found" }, 404);

  const fields: string[] = [];
  const params: unknown[] = [];

  if (body.quota_gb !== undefined) {
    fields.push("quota_gb = ?");
    params.push(Math.max(0, Math.floor(body.quota_gb)));
  }
  if (body.speed_mbps !== undefined) {
    fields.push("speed_mbps = ?");
    params.push(Math.max(0, Math.floor(body.speed_mbps)));
  }
  if (body.max_connections !== undefined) {
    fields.push("max_connections = ?");
    params.push(Math.max(0, Math.floor(body.max_connections)));
  }
  if (body.enabled !== undefined) {
    fields.push("enabled = ?");
    params.push(body.enabled ? 1 : 0);
  }
  if (body.duration_days !== undefined) {
    // Recalculate expires_at from created_at
    const days = Math.max(0, Math.floor(body.duration_days));
    const expiresAt = days > 0 ? existing.created_at + days * 86400000 : null;
    fields.push("duration_days = ?");
    params.push(days);
    fields.push("expires_at = ?");
    params.push(expiresAt);
  }

  if (fields.length === 0) {
    return c.json({ ok: false, error: "nothing to update" }, 400);
  }

  fields.push("updated_at = ?");
  params.push(Date.now());
  params.push(name);

  await run(c.env.DB, \`UPDATE xray_users SET \${fields.join(", ")} WHERE name = ?\`, ...params);

  // Trigger a sync (enabled state might have changed)
  c.executionCtx.waitUntil(
    syncAllUsersToVps(c.env).catch((e) => console.error("sync failed:", e))
  );

  return c.json({ ok: true });
});

`;

c = c.substring(0, idx) + updateEndpoint + c.substring(idx);
fs.writeFileSync(path, c, "utf-8");
console.log("OK - PUT endpoint added");
