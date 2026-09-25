import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// برای INSERT جدید، owner_telegram_id هم اضافه کن
const insertRegex = /"INSERT INTO xray_users \(id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token\) VALUES \(\?, \?, \?, \?, \?, \?, 0, 1, \?, \?, \?, \?, \?\)"/;

if (insertRegex.test(c)) {
  c = c.replace(
    insertRegex,
    '"INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token, owner_telegram_id) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?)"'
  );
  
  // پارامترها
  c = c.replace(
    /(id, xrayUserName, uuid, emailTag, snapshot\.quota_gb, snapshot\.speed_mbps, now, now, expiresAt, snapshot\.duration_days, publicToken)/g,
    '$1, order.user_telegram_id'
  );
  
  console.log("approve INSERT updated");
}

// برای trial هم اضافه کن
const trialInsertRegex = /"INSERT INTO xray_users \(id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token, max_connections\) VALUES \(\?, \?, \?, \?, \?, \?, 0, 1, \?, \?, \?, \?, \?, \?\)"/;

if (trialInsertRegex.test(c)) {
  c = c.replace(
    trialInsertRegex,
    '"INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token, max_connections, owner_telegram_id) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?)"'
  );
  
  c = c.replace(
    /(id, trialUserName, uuid, emailTag, 1, 10, now, now, expiresAt, 1, publicToken, 1)/g,
    '$1, String(from.id)'
  );
  
  console.log("trial INSERT updated");
}

fs.writeFileSync(path, c, "utf-8");
console.log("Done");
