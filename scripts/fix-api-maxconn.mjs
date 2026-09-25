import fs from "node:fs";

const path = "src/ui/apps/xray/api.ts";
let c = fs.readFileSync(path, "utf-8");

// Add max_connections to XrayUser
if (!c.includes("max_connections")) {
  c = c.replace(
    /(duration_days: number;)/,
    '$1\n  max_connections: number;'
  );
}

// Update addUser signature
c = c.replace(
  /addUser: \(name: string, quota_gb: number, speed_mbps: number, duration_days: number\) =>/,
  'addUser: (name: string, quota_gb: number, speed_mbps: number, duration_days: number, max_connections: number) =>'
);

c = c.replace(
  /body: JSON\.stringify\(\{ name, quota_gb, speed_mbps, duration_days \}\)/,
  'body: JSON.stringify({ name, quota_gb, speed_mbps, duration_days, max_connections })'
);

fs.writeFileSync(path, c, "utf-8");
console.log("api.ts OK");
