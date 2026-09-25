// Xray control API — full with auto sync.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { queryAll, queryFirst, run } from "../core/db";
import { NodeClient } from "../adapters/ai/node-client";

export const xrayRoutes = new Hono<{ Bindings: Env }>();

const NODE_ID = "hetzner-nbg1-01";
const SERVER_IP = "91.107.158.188";
const SERVER_PORT = 443;
const SERVER_SNI = "www.cloudflare.com";
const SERVER_PUBLIC_KEY = "Gv_7ATLzr6pq2esXhVHoNlVHQvoxbCMQx-BW1vkDBzI";
const SERVER_SHORT_ID = "ab07221358d8caae";

function node(env: Env): NodeClient { return new NodeClient(env, NODE_ID); }

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function buildVlessLink(name: string, uuid: string): string {
  const params = new URLSearchParams({
    encryption: "none",
    flow: "xtls-rprx-vision",
    security: "reality",
    sni: SERVER_SNI,
    fp: "chrome",
    pbk: SERVER_PUBLIC_KEY,
    sid: SERVER_SHORT_ID,
    type: "tcp",
    headerType: "none",
  });
  return "vless://" + uuid + "@" + SERVER_IP + ":" + SERVER_PORT + "?" + params.toString() + "#" + encodeURIComponent(name);
}

async function syncAllUsersToVps(env: Env): Promise<{ ok: boolean; error?: string }> {
  try {
    // Get all users
    const users = await queryAll(
      env.DB,
      "SELECT name, uuid FROM xray_users WHERE enabled = 1 ORDER BY created_at ASC"
    );

    // Get all enabled nodes
    const nodes = await queryAll(
      env.DB,
      "SELECT id, display_name FROM nodes WHERE enabled = 1 ORDER BY sort_order ASC"
    );

    if (nodes.length === 0) {
      return { ok: false, error: "no nodes configured" };
    }

    const usersData = users.map((u) => ({
      name: u.name,
      uuid: u.uuid,
      enabled: true,
      created_at: Date.now(),
    }));

    const json = JSON.stringify(usersData, null, 2);
    const b64 = btoa(unescape(encodeURIComponent(json)));

    const script = "echo '" + b64 + "' | base64 -d | sudo tee /usr/local/etc/xray/users.json > /dev/null && sudo chown raymond:raymond /usr/local/etc/xray/users.json && bash ~/raymond-node/scripts/xray-sync.sh && sudo systemctl restart xray && echo SYNC_DONE";

    const results: Record<string, { ok: boolean; error?: string }> = {};

    // Sync to all nodes in parallel
    await Promise.all(
      nodes.map(async (node) => {
        try {
          const cli = new NodeClient(env, node.id);
          const r = await cli.task("shell.exec", { cmd: script }, 60000);
          const out = (r.output as { stdout?: string })?.stdout ?? "";
          if (r.ok && out.includes("SYNC_DONE")) {
            results[node.id] = { ok: true };
          } else {
            results[node.id] = { ok: false, error: r.error ?? "sync incomplete" };
          }
        } catch (e) {
          results[node.id] = { ok: false, error: (e as Error).message };
        }
      })
    );

    // Check results
    const failed = Object.entries(results).filter(([, r]) => !r.ok);
    if (failed.length > 0) {
      return {
        ok: false,
        error: "some nodes failed: " + failed.map(([id, r]) => id + ": " + r.error).join("; "),
      };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

xrayRoutes.get("/server", async (c) => {
  return c.json({
    ip: SERVER_IP,
    port: SERVER_PORT,
    sni: SERVER_SNI,
    publicKey: SERVER_PUBLIC_KEY,
    shortId: SERVER_SHORT_ID,
  });
});

xrayRoutes.get("/users", async (c) => {
  try {
    const users = await queryAll(c.env.DB, "SELECT id, name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, duration_days, public_token, max_connections FROM xray_users ORDER BY created_at DESC");
    return c.json({
      ok: true,
      users: (users as any[]).map((u) => ({
        id: u.id, name: u.name, uuid: u.uuid,
        quota_gb: u.quota_gb, speed_mbps: u.speed_mbps, used_bytes: u.used_bytes,
        enabled: u.enabled === 1, created_at: u.created_at, expires_at: u.expires_at,
        duration_days: u.duration_days, public_token: u.public_token,
        max_connections: u.max_connections ?? 0,
      })),
    });
  } catch (e) { return c.json({ ok: false, error: (e as Error).message }, 500); }
});

xrayRoutes.post("/users", async (c) => {
  const body = await c.req.json();
  const name = body.name?.trim();
  if (!name) return c.json({ ok: false, error: "name required" }, 400);

  const quotaGb = Math.max(0, Math.floor(body.quota_gb ?? 0));
  const speedMbps = Math.max(0, Math.floor(body.speed_mbps ?? 0));
  const durationDays = Math.max(0, Math.floor(body.duration_days ?? 0));
  const maxConnections = Math.max(0, Math.floor(body.max_connections ?? 0));

  const existing = await queryFirst(c.env.DB, "SELECT id FROM xray_users WHERE name = ? LIMIT 1", name);
  if (existing) return c.json({ ok: false, error: "name already exists" }, 409);

  try {
    const uuidRes = await node(c.env).task("xray.uuid");
    if (!uuidRes.ok || !uuidRes.output) return c.json({ ok: false, error: "uuid failed" }, 500);
    const uuid = ((uuidRes.output as any).stdout as string).trim();
    const id = "xu_" + randomHex(12);
    const publicToken = randomHex(16);
    const emailTag = name + "@raymond";
    const now = Date.now();
    const expiresAt = durationDays > 0 ? now + durationDays * 86400000 : null;

    await run(c.env.DB,
      "INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token, max_connections) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?)",
      id, name, uuid, emailTag, quotaGb, speedMbps, now, now, expiresAt, durationDays, publicToken, maxConnections);

    const syncResult = await syncAllUsersToVps(c.env);
    console.log("sync:", JSON.stringify(syncResult));

    return c.json({
      ok: true,
      user: { id, name, uuid, quota_gb: quotaGb, speed_mbps: speedMbps, used_bytes: 0, enabled: true, created_at: now, expires_at: expiresAt, duration_days: durationDays, public_token: publicToken },
      link: buildVlessLink(name, uuid),
      synced: syncResult.ok,
      syncError: syncResult.error,
    });
  } catch (e) { return c.json({ ok: false, error: (e as Error).message }, 500); }
});

xrayRoutes.put("/users/:name", async (c) => {
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

  await run(c.env.DB, `UPDATE xray_users SET ${fields.join(", ")} WHERE name = ?`, ...params);

  // Trigger a sync (enabled state might have changed)
  c.executionCtx.waitUntil(
    syncAllUsersToVps(c.env).catch((e) => console.error("sync failed:", e))
  );

  return c.json({ ok: true });
});

xrayRoutes.delete("/users/:name", async (c) => {
  const name = c.req.param("name");
  try {
    await run(c.env.DB, "DELETE FROM xray_users WHERE name = ?", name);
    await syncAllUsersToVps(c.env);
    return c.json({ ok: true });
  } catch (e) { return c.json({ ok: false, error: (e as Error).message }, 500); }
});

xrayRoutes.get("/users/:name/link", async (c) => {
  const name = c.req.param("name");
  const user = await queryFirst(c.env.DB, "SELECT uuid FROM xray_users WHERE name = ? LIMIT 1", name);
  if (!user) return c.json({ ok: false, error: "not found" }, 404);
  return c.json({ ok: true, link: buildVlessLink(name, (user as any).uuid) });
});

xrayRoutes.post("/sync-all", async (c) => {
  const result = await syncAllUsersToVps(c.env);
  return c.json(result);
});

xrayRoutes.post("/sync-stats", async (c) => {
  try {
    const statsRes = await node(c.env).task("xray.stats");
    if (!statsRes.ok || !statsRes.output) return c.json({ ok: false, error: "stats failed" }, 500);

    const stats = JSON.parse((statsRes.output as any).stdout as string);
    const perUser: Record<string, number> = {};
    for (const s of stats.stat ?? []) {
      const m = s.name.match(/^user>>>(.+)@raymond>>>traffic>>>(uplink|downlink)$/);
      if (!m) continue;
      const userName = m[1];
      if (!perUser[userName]) perUser[userName] = 0;
      perUser[userName] += s.value;
    }

    const now = Date.now();
    let updated = 0;
    for (const [name, bytes] of Object.entries(perUser)) {
      await run(c.env.DB, "UPDATE xray_users SET used_bytes = ?, last_sync_at = ?, updated_at = ? WHERE name = ?", bytes, now, now, name);
      updated++;
    }

    return c.json({ ok: true, updated, users: Object.keys(perUser).length });
  } catch (e) { return c.json({ ok: false, error: (e as Error).message }, 500); }
});

xrayRoutes.get("/sub/:token", async (c) => {
  const token = c.req.param("token");
  const user = await queryFirst(c.env.DB, "SELECT name, uuid, quota_gb, used_bytes, enabled, expires_at FROM xray_users WHERE public_token = ? LIMIT 1", token);
  if (!user) return new Response("Not found", { status: 404 });

  // Fetch all enabled nodes
  const nodes = await queryAll(
    c.env.DB,
    "SELECT id, display_name, flag, ip, port, sni, public_key, short_id FROM nodes WHERE enabled = 1 ORDER BY sort_order ASC"
  );

  if (nodes.length === 0) {
    return new Response("No nodes available", { status: 503 });
  }

  // Build a VLESS link for each node
  const links = [];
  for (const n of nodes) {
    const params = new URLSearchParams({
      encryption: "none",
      flow: "xtls-rprx-vision",
      security: "reality",
      sni: n.sni,
      fp: "chrome",
      pbk: n.public_key,
      sid: n.short_id,
      type: "tcp",
      headerType: "none",
    });
    const flag = n.flag ? n.flag + " " : "";
    const label = flag + n.display_name;
    const link = "vless://" + user.uuid + "@" + n.ip + ":" + n.port + "?" + params.toString() + "#" + encodeURIComponent(label);
    links.push(link);
  }

  // Join links with newline and base64-encode
  const joined = links.join("\n");
  const body = btoa(unescape(encodeURIComponent(joined)));

  const totalBytes = user.quota_gb > 0 ? user.quota_gb * 1073741824 : 0;
  const expireTs = user.expires_at ? Math.floor(user.expires_at / 1000) : 0;
  const userInfo = "upload=0; download=" + user.used_bytes + "; total=" + totalBytes + "; expire=" + expireTs;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "subscription-userinfo": userInfo,
      "profile-title": "Raymond - " + user.name,
      "profile-update-interval": "24",
      "Cache-Control": "no-store",
    },
  });
});
