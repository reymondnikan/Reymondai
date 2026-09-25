// Shop management API — products, orders, settings.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { queryAll, queryFirst, run } from "../core/db";
import { NodeClient } from "../adapters/ai/node-client";

export const shopRoutes = new Hono<{ Bindings: Env }>();

const NODE_ID = "hetzner-nbg1-01";

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function node(env: Env): NodeClient {
  return new NodeClient(env, NODE_ID);
}

// ============================================================
// Settings
// ============================================================
shopRoutes.get("/settings", async (c) => {
  const rows = await queryAll<{ key: string; value: string }>(
    c.env.DB,
    "SELECT key, value FROM shop_settings"
  );
  const out: Record<string, string> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return c.json({ ok: true, settings: out });
});

shopRoutes.put("/settings/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.json<{ value: string }>();
  const value = JSON.stringify(body.value ?? "");
  await run(
    c.env.DB,
    "INSERT INTO shop_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    key,
    value,
    Date.now()
  );
  return c.json({ ok: true });
});

// ============================================================
// Products
// ============================================================
shopRoutes.get("/products", async (c) => {
  const products = await queryAll(
    c.env.DB,
    "SELECT id, name, description, quota_gb, speed_mbps, duration_days, price_toman, enabled, sort_order, created_at FROM products ORDER BY sort_order ASC, created_at ASC"
  );
  return c.json({ ok: true, products });
});

shopRoutes.post("/products", async (c) => {
  const body = await c.req.json<{
    name?: string;
    description?: string;
    quota_gb?: number;
    speed_mbps?: number;
    duration_days?: number;
    price_toman?: number;
  }>();
  const name = body.name?.trim();
  if (!name) return c.json({ ok: false, error: "name required" }, 400);

  const id = "prod_" + randomHex(8);
  const now = Date.now();

  await run(
    c.env.DB,
    `INSERT INTO products (id, name, description, quota_gb, speed_mbps, duration_days, price_toman, enabled, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 100, ?, ?)`,
    id,
    name,
    body.description ?? "",
    Math.max(0, Math.floor(body.quota_gb ?? 0)),
    Math.max(0, Math.floor(body.speed_mbps ?? 0)),
    Math.max(0, Math.floor(body.duration_days ?? 0)),
    Math.max(0, Math.floor(body.price_toman ?? 0)),
    now,
    now
  );

  return c.json({ ok: true, id });
});

shopRoutes.put("/products/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    description?: string;
    quota_gb?: number;
    speed_mbps?: number;
    duration_days?: number;
    price_toman?: number;
    enabled?: boolean;
    sort_order?: number;
  }>();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { fields.push("name = ?"); params.push(body.name.trim()); }
  if (body.description !== undefined) { fields.push("description = ?"); params.push(body.description); }
  if (body.quota_gb !== undefined) { fields.push("quota_gb = ?"); params.push(Math.max(0, Math.floor(body.quota_gb))); }
  if (body.speed_mbps !== undefined) { fields.push("speed_mbps = ?"); params.push(Math.max(0, Math.floor(body.speed_mbps))); }
  if (body.duration_days !== undefined) { fields.push("duration_days = ?"); params.push(Math.max(0, Math.floor(body.duration_days))); }
  if (body.price_toman !== undefined) { fields.push("price_toman = ?"); params.push(Math.max(0, Math.floor(body.price_toman))); }
  if (body.enabled !== undefined) { fields.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }
  if (body.sort_order !== undefined) { fields.push("sort_order = ?"); params.push(Math.floor(body.sort_order)); }

  if (fields.length === 0) return c.json({ ok: false, error: "nothing to update" }, 400);

  fields.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  await run(c.env.DB, `UPDATE products SET ${fields.join(", ")} WHERE id = ?`, ...params);
  return c.json({ ok: true });
});

shopRoutes.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  await run(c.env.DB, "DELETE FROM products WHERE id = ?", id);
  return c.json({ ok: true });
});

// ============================================================
// Orders
// ============================================================
shopRoutes.get("/orders", async (c) => {
  const status = c.req.query("status");
  let sql = "SELECT id, user_telegram_id, user_username, user_first_name, product_name, price_toman, status, xray_user_name, xray_sub_token, created_at, approved_at FROM orders";
  const params: unknown[] = [];
  if (status) {
    sql += " WHERE status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC LIMIT 200";

  const orders = await queryAll(c.env.DB, sql, ...params);
  return c.json({ ok: true, orders });
});

// ============================================================
// Stats
// ============================================================
shopRoutes.get("/stats", async (c) => {
  const total = await queryFirst<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM orders");
  const pending = await queryFirst<{ c: number }>(
    c.env.DB,
    "SELECT COUNT(*) as c FROM orders WHERE status = 'pending_approval'"
  );
  const completed = await queryFirst<{ c: number }>(
    c.env.DB,
    "SELECT COUNT(*) as c FROM orders WHERE status = 'completed'"
  );
  const rejected = await queryFirst<{ c: number }>(
    c.env.DB,
    "SELECT COUNT(*) as c FROM orders WHERE status = 'rejected'"
  );
  const revenue = await queryFirst<{ s: number }>(
    c.env.DB,
    "SELECT COALESCE(SUM(price_toman), 0) as s FROM orders WHERE status = 'completed'"
  );
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const revenueToday = await queryFirst<{ s: number }>(
    c.env.DB,
    "SELECT COALESCE(SUM(price_toman), 0) as s FROM orders WHERE status = 'completed' AND approved_at >= ?",
    todayStart.getTime()
  );

  return c.json({
    ok: true,
    total: total?.c ?? 0,
    pending: pending?.c ?? 0,
    completed: completed?.c ?? 0,
    rejected: rejected?.c ?? 0,
    revenue: revenue?.s ?? 0,
    revenueToday: revenueToday?.s ?? 0,
  });
});

// ============================================================
// Approve order (from panel)
// ============================================================
shopRoutes.post("/orders/:id/approve", async (c) => {
  const orderId = c.req.param("id");
  const order = await queryFirst<{
    id: string;
    user_telegram_id: string;
    product_name: string;
    product_snapshot: string;
    status: string;
  }>(
    c.env.DB,
    "SELECT id, user_telegram_id, product_name, product_snapshot, status FROM orders WHERE id = ? LIMIT 1",
    orderId
  );
  if (!order) return c.json({ ok: false, error: "not found" }, 404);
  if (order.status === "completed") return c.json({ ok: false, error: "already completed" }, 400);

  const snapshot = JSON.parse(order.product_snapshot) as {
    quota_gb: number;
    speed_mbps: number;
    duration_days: number;
  };

  const xrayUserName = "tg" + order.user_telegram_id + "_" + randomHex(3);

  try {
    // 1. UUID from node
    const uuidRes = await node(c.env).task<{ stdout: string }>("xray.uuid");
    if (!uuidRes.ok || !uuidRes.output) throw new Error("uuid failed");
    const uuid = uuidRes.output.stdout.trim();

    // 2. Insert user
    const id = "xu_" + randomHex(12);
    const publicToken = randomHex(16);
    const emailTag = xrayUserName + "@raymond";
    const now = Date.now();
    const expiresAt = snapshot.duration_days > 0 ? now + snapshot.duration_days * 86400000 : null;

    await run(
      c.env.DB,
      "INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)",
      id, xrayUserName, uuid, emailTag, snapshot.quota_gb, snapshot.speed_mbps, now, now, expiresAt, snapshot.duration_days, publicToken
    );

    // 3. Sync to VPS
    const users = await queryAll<{ name: string; uuid: string }>(
      c.env.DB,
      "SELECT name, uuid FROM xray_users WHERE enabled = 1 ORDER BY created_at ASC"
    );
    const usersData = users.map((u) => ({
      name: u.name,
      uuid: u.uuid,
      enabled: true,
      created_at: Date.now(),
    }));
    const json = JSON.stringify(usersData, null, 2);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const script = "echo '" + b64 + "' | base64 -d | sudo tee /usr/local/etc/xray/users.json > /dev/null && sudo chown raymond:raymond /usr/local/etc/xray/users.json && bash ~/raymond-node/scripts/xray-sync.sh && sudo systemctl restart xray && echo SYNC_DONE";

    const syncRes = await node(c.env).task<{ stdout: string }>("shell.exec", { cmd: script }, 60000);
    if (!syncRes.ok || !syncRes.output || !syncRes.output.stdout.includes("SYNC_DONE")) {
      console.error("sync failed:", syncRes.error);
    }

    // 4. Update order
    await run(
      c.env.DB,
      "UPDATE orders SET status = 'completed', approved_at = ?, xray_user_name = ?, xray_sub_token = ?, updated_at = ? WHERE id = ?",
      now,
      xrayUserName,
      publicToken,
      now,
      orderId
    );

    // 5. Notify user via Telegram
    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + publicToken;
      const msg =
        "🎉 <b>پرداخت شما تایید شد!</b>\n\n" +
        "📦 " + order.product_name + "\n" +
        "📊 " + snapshot.quota_gb + " GB / " + snapshot.duration_days + " روز\n\n" +
        "🔗 <code>" + subUrl + "</code>\n\n" +
        "لینک رو توی V2Box import کن.";

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: order.user_telegram_id,
          text: msg,
          parse_mode: "HTML",
        }),
      }).catch((e) => console.error("notify user failed:", e));
    }

    return c.json({ ok: true, xrayUserName, publicToken });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});

// ============================================================
// Reject order
// ============================================================
shopRoutes.post("/orders/:id/reject", async (c) => {
  const orderId = c.req.param("id");
  const body = await c.req.json<{ reason?: string }>().catch(() => ({ reason: "" }));

  const order = await queryFirst<{
    id: string;
    user_telegram_id: string;
    product_name: string;
  }>(
    c.env.DB,
    "SELECT id, user_telegram_id, product_name FROM orders WHERE id = ? LIMIT 1",
    orderId
  );
  if (!order) return c.json({ ok: false, error: "not found" }, 404);

  await run(
    c.env.DB,
    "UPDATE orders SET status = 'rejected', rejected_reason = ?, updated_at = ? WHERE id = ?",
    body.reason ?? "",
    Date.now(),
    orderId
  );

  // Notify user
  const botToken = c.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    const msg =
      "❌ <b>سفارش شما رد شد</b>\n\n📦 " + order.product_name +
      (body.reason ? "\n\nدلیل: " + body.reason : "");
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: order.user_telegram_id,
        text: msg,
        parse_mode: "HTML",
      }),
    }).catch((e) => console.error("notify failed:", e));
  }

  return c.json({ ok: true });
});

// ============================================================
// Delete order
// ============================================================
shopRoutes.delete("/orders/:id", async (c) => {
  const id = c.req.param("id");
  await run(c.env.DB, "DELETE FROM orders WHERE id = ?", id);
  return c.json({ ok: true });
});
