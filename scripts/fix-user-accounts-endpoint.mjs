import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

// حذف endpoint قدیمی public/user-accounts
c = c.replace(/xrayRoutes\.get\("\/public\/user-accounts\/:token"[\s\S]*?\n\}\);\n/g, "");

// اضافه کردن نسخه درست
const newEndpoint = `

// ============================================================
// PUBLIC: all accounts for a user-page token
// ============================================================
xrayRoutes.get("/public/user-accounts/:token", async (c) => {
  const token = c.req.param("token");

  const page = await queryFirst<{ telegram_id: string }>(
    c.env.DB,
    "SELECT telegram_id FROM user_pages WHERE token = ? LIMIT 1",
    token
  );
  if (!page) return c.json({ ok: false, error: "not found" }, 404);

  // اکانت‌هایی که owner_telegram_id دارن
  const users = await queryAll<{
    name: string;
    uuid: string;
    quota_gb: number;
    speed_mbps: number;
    used_bytes: number;
    enabled: number;
    created_at: number;
    expires_at: number | null;
    public_token: string;
  }>(
    c.env.DB,
    "SELECT name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, public_token FROM xray_users WHERE owner_telegram_id = ? ORDER BY created_at DESC",
    page.telegram_id
  );

  const now = Date.now();
  const accounts = users.map((u) => {
    const expiresAt = u.expires_at;
    const daysRemaining = expiresAt
      ? Math.max(0, Math.ceil((expiresAt - now) / 86400000))
      : null;
    const expired = expiresAt !== null && expiresAt < now;
    const quotaBytes = u.quota_gb > 0 ? u.quota_gb * 1073741824 : 0;
    const quotaUsedPct =
      quotaBytes > 0 ? Math.min(100, (u.used_bytes / quotaBytes) * 100) : 0;
    const remainingBytes =
      quotaBytes > 0 ? Math.max(0, quotaBytes - u.used_bytes) : null;

    return {
      name: u.name,
      enabled: u.enabled === 1 && !expired,
      expired,
      quota_gb: u.quota_gb,
      used_bytes: u.used_bytes,
      remaining_bytes: remainingBytes,
      quota_used_pct: quotaUsedPct,
      speed_mbps: u.speed_mbps,
      created_at: u.created_at,
      expires_at: expiresAt,
      days_remaining: daysRemaining,
      public_token: u.public_token,
    };
  });

  return c.json({
    ok: true,
    telegram_id: page.telegram_id,
    accounts,
  });
});
`;

c = c.trimEnd() + "\n" + newEndpoint + "\n";

fs.writeFileSync(path, c, "utf-8");
console.log("public/user-accounts updated");
