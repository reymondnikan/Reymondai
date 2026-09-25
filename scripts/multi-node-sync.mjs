import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

// Find and replace the syncAllUsersToVps function
const newSync = `async function syncAllUsersToVps(env: Env): Promise<{ ok: boolean; error?: string }> {
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
}`;

// Find existing syncAllUsersToVps function
const startMarker = 'async function syncAllUsersToVps(env: Env): Promise<{ ok: boolean; error?: string }> {';
const startIdx = c.indexOf(startMarker);

if (startIdx === -1) {
  console.log("ERROR: syncAllUsersToVps not found");
  process.exit(1);
}

// Find end: first "\\n}\\n" (function close) after startIdx
const afterStart = c.substring(startIdx);
const endRegex = /\n\}/;
const endMatch = afterStart.match(endRegex);
if (!endMatch || endMatch.index === undefined) {
  console.log("ERROR: end of function not found");
  process.exit(1);
}

const endIdx = startIdx + endMatch.index + endMatch[0].length;

c = c.substring(0, startIdx) + newSync + c.substring(endIdx);

// Add NodeClient + queryAll imports if missing
if (!c.includes('import { NodeClient }')) {
  // insert after the first import
  c = c.replace(
    /(import \{ Hono \} from "hono";)/,
    '$1\nimport { NodeClient } from "../adapters/ai/node-client";'
  );
}

fs.writeFileSync(path, c, "utf-8");
console.log("OK. New length:", c.length);
