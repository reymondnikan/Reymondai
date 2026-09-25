// Cron-triggered background tasks.
//
// Runs every 5 minutes:
//   1. Disable users who exceeded quota
//   2. Disable users whose expiration passed
//   3. Sync changes to all VPS nodes
//   4. Reset Xray stats for disabled users

import type { Env } from "./core/db";
import { queryAll, run } from "./core/db";
import { NodeClient } from "./adapters/ai/node-client";

export async function handleCron(env: Env): Promise<void> {
  console.log("[cron] starting scheduled check");

  try {
    const now = Date.now();

    // 1. Find users who exceeded quota
    const overQuota = await queryAll<{
      name: string;
      quota_gb: number;
      used_bytes: number;
      node_id: string;
    }>(
      env.DB,
      `SELECT name, quota_gb, used_bytes, node_id FROM xray_users 
       WHERE enabled = 1 
       AND quota_gb > 0 
       AND used_bytes >= (quota_gb * 1073741824)`
    );

    // 2. Find expired users
    const expired = await queryAll<{
      name: string;
      expires_at: number;
      node_id: string;
    }>(
      env.DB,
      `SELECT name, expires_at, node_id FROM xray_users 
       WHERE enabled = 1 
       AND expires_at IS NOT NULL 
       AND expires_at <= ?`,
      now
    );

    const toDisable = new Set<string>();
    for (const u of overQuota) toDisable.add(u.name);
    for (const u of expired) toDisable.add(u.name);

    if (toDisable.size === 0) {
      console.log("[cron] nothing to do");
      return;
    }

    console.log(`[cron] disabling ${toDisable.size} users:`, Array.from(toDisable));

    // 3. Disable them in D1
    for (const name of toDisable) {
      await run(
        env.DB,
        "UPDATE xray_users SET enabled = 0, updated_at = ? WHERE name = ?",
        now,
        name
      );

      // Audit log
      const reason = overQuota.find((u) => u.name === name)
        ? "quota_exceeded"
        : "expired";
      await run(
        env.DB,
        "INSERT INTO audit_log (id, actor, action, resource_type, resource_id, metadata, created_at) VALUES (?, 'cron', 'user.disabled', 'xray_user', ?, ?, ?)",
        "aud_" + randomHex(12),
        name,
        JSON.stringify({ reason }),
        now
      );
    }

    // 4. Sync to all VPS nodes
    await syncToAllNodes(env);

    console.log("[cron] done");
  } catch (err) {
    console.error("[cron] error:", err);
  }
}

async function syncToAllNodes(env: Env): Promise<void> {
  try {
    // Build users.json from enabled users only
    const users = await queryAll<{ name: string; uuid: string }>(
      env.DB,
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

    const script =
      "echo '" + b64 + "' | base64 -d | sudo tee /usr/local/etc/xray/users.json > /dev/null && sudo chown raymond:raymond /usr/local/etc/xray/users.json && bash ~/raymond-node/scripts/xray-sync.sh && sudo systemctl restart xray && echo SYNC_DONE";

    const nodes = await queryAll<{ id: string }>(
      env.DB,
      "SELECT id FROM nodes WHERE enabled = 1"
    );

    await Promise.all(
      nodes.map(async (n) => {
        try {
          const cli = new NodeClient(env, n.id);
          const r = await cli.task<{ stdout: string }>(
            "shell.exec",
            { cmd: script },
            60000
          );
          if (r.ok && r.output?.stdout?.includes("SYNC_DONE")) {
            console.log(`[cron] synced to ${n.id}`);
          } else {
            console.error(`[cron] sync to ${n.id} failed`);
          }
        } catch (e) {
          console.error(`[cron] sync to ${n.id} error:`, e);
        }
      })
    );
  } catch (e) {
    console.error("[cron] syncToAllNodes error:", e);
  }
}

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
