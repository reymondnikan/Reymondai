import fs from "node:fs";

const content = `// Xray control API — with quota, speed, expiration, and public tokens.

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

function node(env: Env): NodeClient {
  return new NodeClient(env, NODE_ID);
}

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
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
    const users = await queryAll(
      c.env.DB,
      "SELECT id, name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, duration_days, public_token FROM xray_users ORDER BY created_at DESC"
    );

    return c.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        uuid: u.uuid,
        quota_gb: u.quota_gb,
        speed_mbps: u.speed_mbps,
        used_bytes: u.used_bytes,
        enabled: u.enabled === 1,
        created_at: u.created_at,
        expires_at: u.expires_at,
        duration_days: u.duration_days,
        public_token: u.public_token,
      })),
    });
  } catch (e) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

xrayRoutes.post("/users", async (c) => {
  const body = await c.req.json();
  const name = body.name?.trim();
  if (!name) return c.json({ ok: false, error: "name required" }, 400);

  const quotaGb = Math.max(0, Math.floor(body.quota_gb ?? 0));
  const speedMbps = Math.max(0, Math.floor(body.speed_mbps ?? 0));
  const durationDays = Math.max(0, Math.floor(body.duration_days ?? 0));

  const existing = await queryFirst(
    c.env.DB,
    "SELECT id FROM xray_users WHERE name = ? LIMIT 1",
    name
  );
  if (existing) return c.json({ ok: false, error: "name already exists" }, 409);

  try {
    const uuidRes = await node(c.env).task("xray.uuid");
    if (!uuidRes.ok || !uuidRes.output) {
      return c.json({ ok: false, error: "could not generate uuid" }, 500);
    }
    const uuid = uuidRes.output.stdout.trim();
    const id = "xu_" + randomHex(12);
    const publicToken = randomHex(16);
    const emailTag = name + "@raymond";
    const now = Date.now();
    const expiresAt = durationDays > 0 ? now + durationDays * 86400000 : null;

    await run(
      c.env.DB,
      "INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)",
      id, name, uuid, emailTag, quotaGb, speedMbps, now, now, expiresAt, durationDays, publicToken
    );

    const link = buildVlessLink(name, uuid);

    return c.json({
      ok: true,
      user: {
        id,
        name,
        uuid,
        quota_gb: quotaGb,
        speed_mbps: speedMbps,
        used_bytes: 0,
        enabled: true,
        created_at: now,
        expires_at: expiresAt,
        duration_days: durationDays,
        public_token: publicToken,
      },
      link,
    });
  } catch (e) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

xrayRoutes.delete("/users/:name", async (c) => {
  const name = c.req.param("name");
  try {
    await run(c.env.DB, "DELETE FROM xray_users WHERE name = ?", name);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

xrayRoutes.get("/users/:name/link", async (c) => {
  const name = c.req.param("name");
  const user = await queryFirst(
    c.env.DB,
    "SELECT uuid FROM xray_users WHERE name = ? LIMIT 1",
    name
  );
  if (!user) return c.json({ ok: false, error: "user not found" }, 404);
  return c.json({ ok: true, link: buildVlessLink(name, user.uuid) });
});

xrayRoutes.post("/sync-stats", async (c) => {
  try {
    const statsRes = await node(c.env).task("xray.stats");
    if (!statsRes.ok || !statsRes.output) {
      return c.json({ ok: false, error: "stats fetch failed" }, 500);
    }

    const stats = JSON.parse(statsRes.output.stdout);
    const perUser = {};
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
      await run(
        c.env.DB,
        "UPDATE xray_users SET used_bytes = ?, last_sync_at = ?, updated_at = ? WHERE name = ?",
        bytes, now, now, name
      );
      updated++;
    }

    return c.json({ ok: true, updated, users: Object.keys(perUser).length });
  } catch (e) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

xrayRoutes.get("/sub/:token", async (c) => {
  const token = c.req.param("token");
  const user = await queryFirst(
    c.env.DB,
    "SELECT name, uuid, quota_gb, used_bytes, enabled, expires_at FROM xray_users WHERE public_token = ? LIMIT 1",
    token
  );

  if (!user) return new Response("Not found", { status: 404 });

  const link = buildVlessLink(user.name, user.uuid);
  const body = btoa(link);
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

function buildVlessLink(name, uuid) {
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
`;

fs.writeFileSync("src/worker/routes/xray.ts", content, "utf-8");
console.log("OK", content.length);
