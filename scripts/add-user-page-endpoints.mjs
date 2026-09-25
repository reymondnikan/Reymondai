import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("getUserPageToken")) {
  console.log("Already has user-page-token");
  process.exit(0);
}

const newEndpoint = `

// ============================================================
// Get (or create) a user-page token for a telegram user
// ============================================================
xrayRoutes.get("/user-page/:telegramId", async (c) => {
  const telegramId = c.req.param("telegramId");

  // اگه از قبل وجود داره، برگردون
  const existing = await queryFirst<{ token: string }>(
    c.env.DB,
    "SELECT token FROM user_pages WHERE telegram_id = ? LIMIT 1",
    telegramId
  );

  let token: string;
  if (existing) {
    token = existing.token;
  } else {
    // بساز
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    await run(
      c.env.DB,
      "INSERT INTO user_pages (token, telegram_id, created_at) VALUES (?, ?, ?)",
      token,
      telegramId,
      Date.now()
    );
  }

  const url = new URL(c.req.url);
  return c.json({
    ok: true,
    url: url.origin + "/u/" + token,
    token,
  });
});

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

  // همه اکانت‌های این کاربر
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
    "SELECT name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, public_token FROM xray_users WHERE created_at IN (SELECT created_at FROM xray_users WHERE 1=1) ORDER BY created_at DESC"
  );

  // فیلتر بر اساس telegram_id توی name (چون نام‌ها با tg شروع می‌شن)
  // کاربرانی که با tgXXX ساخته شدن → tgXXX = telegram_id
  const filtered = users.filter((u) => {
    // نام‌هایی مثل tg5647595015_XXXX
    const match = u.name.match(/^tg(\d+)_/);
    if (match && match[1] === page.telegram_id) return true;
    return false;
  });

  const now = Date.now();
  const accounts = filtered.map((u) => {
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
console.log("endpoints added");
