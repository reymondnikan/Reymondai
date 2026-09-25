import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

// چک کن SELECT users داره یا نه
if (!c.includes("owner_telegram_id FROM xray_users")) {
  // آپدیت SELECT users
  c = c.replace(
    /"SELECT id, name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, duration_days, public_token, max_connections FROM xray_users ORDER BY created_at DESC"/,
    '"SELECT id, name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, duration_days, public_token, max_connections, owner_telegram_id FROM xray_users ORDER BY created_at DESC"'
  );

  // آپدیت map — اضافه کردن owner_telegram_id
  c = c.replace(
    /(max_connections: u\.max_connections \?\? 0,\s*\n)(\s*\}\)\),)/,
    '$1        owner_telegram_id: u.owner_telegram_id ?? null,\n$2'
  );

  fs.writeFileSync(path, c, "utf-8");
  console.log("backend updated");
} else {
  console.log("already has owner_telegram_id");
}
