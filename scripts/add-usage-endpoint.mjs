import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("public/usage")) {
  console.log("Already has public/usage");
  process.exit(0);
}

const endpoint = `

// ============================================================
// PUBLIC: user usage data (for /u/:token page)
// ============================================================
xrayRoutes.get("/public/usage/:token", async (c) => {
  const token = c.req.param("token");
  const user = await queryFirst<{
    name: string;
    uuid: string;
    quota_gb: number;
    speed_mbps: number;
    used_bytes: number;
    enabled: number;
    created_at: number;
    expires_at: number | null;
  }>(
    c.env.DB,
    "SELECT name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at FROM xray_users WHERE public_token = ? LIMIT 1",
    token
  );

  if (!user) return c.json({ ok: false, error: "not found" }, 404);

  const now = Date.now();
  const expiresAt = user.expires_at;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 86400000))
    : null;
  const expired = expiresAt !== null && expiresAt < now;
  const quotaBytes = user.quota_gb > 0 ? user.quota_gb * 1073741824 : 0;
  const quotaUsedPct =
    quotaBytes > 0 ? Math.min(100, (user.used_bytes / quotaBytes) * 100) : 0;
  const remainingBytes =
    quotaBytes > 0 ? Math.max(0, quotaBytes - user.used_bytes) : null;

  return c.json({
    ok: true,
    user: {
      name: user.name,
      enabled: user.enabled === 1 && !expired,
      expired,
      quota_gb: user.quota_gb,
      used_bytes: user.used_bytes,
      remaining_bytes: remainingBytes,
      quota_used_pct: quotaUsedPct,
      speed_mbps: user.speed_mbps,
      created_at: user.created_at,
      expires_at: expiresAt,
      days_remaining: daysRemaining,
    },
  });
});
`;

c = c.trimEnd() + "\n" + endpoint + "\n";

fs.writeFileSync(path, c, "utf-8");
console.log("public/usage added:", endpoint.length, "bytes");
