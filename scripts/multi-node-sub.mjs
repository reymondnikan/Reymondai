import fs from "node:fs";

const path = "src/worker/routes/xray.ts";
let c = fs.readFileSync(path, "utf-8");

// Find and replace the /sub/:token endpoint
const newSub = `xrayRoutes.get("/sub/:token", async (c) => {
  const token = c.req.param("token");
  const user = await queryFirst(c.env.DB, "SELECT name, uuid, quota_gb, used_bytes, enabled, expires_at FROM xray_users WHERE public_token = ? LIMIT 1", token);
  if (!user) return new Response("Not found", { status: 404 });

  // Fetch all enabled nodes
  const nodes = await queryAll(
    c.env.DB,
    "SELECT id, display_name, flag, ip, port, sni, public_key, short_id FROM nodes WHERE enabled = 1 ORDER BY sort_order ASC"
  );

  if (nodes.length === 0) {
    return new Response("No nodes available", { status: 503 });
  }

  // Build a VLESS link for each node
  const links = [];
  for (const n of nodes) {
    const params = new URLSearchParams({
      encryption: "none",
      flow: "xtls-rprx-vision",
      security: "reality",
      sni: n.sni,
      fp: "chrome",
      pbk: n.public_key,
      sid: n.short_id,
      type: "tcp",
      headerType: "none",
    });
    const flag = n.flag ? n.flag + " " : "";
    const label = flag + n.display_name;
    const link = "vless://" + user.uuid + "@" + n.ip + ":" + n.port + "?" + params.toString() + "#" + encodeURIComponent(label);
    links.push(link);
  }

  // Join links with newline and base64-encode
  const joined = links.join("\\n");
  const body = btoa(unescape(encodeURIComponent(joined)));

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
});`;

// Find the existing /sub/:token block
const startMarker = 'xrayRoutes.get("/sub/:token", async (c) => {';
const startIdx = c.indexOf(startMarker);

if (startIdx === -1) {
  console.log("ERROR: sub endpoint not found");
  process.exit(1);
}

// Find the matching closing "});" after startIdx
// We search for "\n});" which typically ends the block
let depth = 0;
let i = startIdx;
let endIdx = -1;

// Simple approach: find next "});" followed by newline at column 0 (or after 2 spaces)
const afterStart = c.substring(startIdx);
// Match: first "});" that appears at the start of a line
const endRegex = /\n\}\);/;
const endMatch = afterStart.match(endRegex);
if (endMatch && endMatch.index !== undefined) {
  endIdx = startIdx + endMatch.index + endMatch[0].length;
}

if (endIdx === -1) {
  console.log("ERROR: end of sub endpoint not found");
  process.exit(1);
}

c = c.substring(0, startIdx) + newSub + c.substring(endIdx);
fs.writeFileSync(path, c, "utf-8");
console.log("OK. New length:", c.length);
