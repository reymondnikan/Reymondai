import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

// 1. Add max_connections to GET /users SELECT
c = c.replace(
  /"SELECT id, name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, duration_days, public_token FROM xray_users ORDER BY created_at DESC"/,
  '"SELECT id, name, uuid, quota_gb, speed_mbps, used_bytes, enabled, created_at, expires_at, duration_days, public_token, max_connections FROM xray_users ORDER BY created_at DESC"'
);

// 2. Add to response map
c = c.replace(
  /(public_token: u\.public_token,\s*\n)(\s*\}\)\),)/,
  '$1        max_connections: u.max_connections ?? 0,\n$2'
);

// 3. Add to POST body type
c = c.replace(
  /duration_days\?: number;\s*\n\s*max_connections\?: number;/,
  'duration_days?: number;\n    max_connections?: number;'
);

// Fallback: if not present, add it
if (!c.includes("max_connections?: number;")) {
  c = c.replace(
    /(duration_days\?: number;)/,
    '$1\n    max_connections?: number;'
  );
}

// 4. Add to POST parse
if (!c.includes("maxConnections")) {
  c = c.replace(
    /(const durationDays = Math\.max\(0, Math\.floor\(body\.duration_days \?\? 0\)\);)/,
    '$1\n  const maxConnections = Math.max(0, Math.floor(body.max_connections ?? 0));'
  );
}

// 5. Update INSERT
c = c.replace(
  /"INSERT INTO xray_users \(id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token\) VALUES \(\?, \?, \?, \?, \?, \?, 0, 1, \?, \?, \?, \?, \?\)"/g,
  '"INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token, max_connections) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?)"'
);

// 6. Update INSERT params - first occurrence
c = c.replace(
  /(id, name, uuid, emailTag, quotaGb, speedMbps, now, now, expiresAt, durationDays, publicToken)/g,
  '$1, maxConnections'
);

// 7. Add to response user object
c = c.replace(
  /(public_token: publicToken,\s*\n)(\s*\},)/g,
  '$1        max_connections: maxConnections,\n$2'
);

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
