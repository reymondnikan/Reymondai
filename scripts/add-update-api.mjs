import fs from "node:fs";

const path = "src/ui/apps/xray/api.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("updateUser:")) {
  console.log("updateUser already exists");
  process.exit(0);
}

// Add after removeUser
const insertAfter = `removeUser: (name: string) =>`;
const idx = c.indexOf(insertAfter);

if (idx === -1) {
  console.log("removeUser not found");
  process.exit(1);
}

// Find the end of removeUser definition (the closing `),`)
const rest = c.substring(idx);
const endIdx = rest.indexOf("),") + 2;

const insert = `
  updateUser: (
    name: string,
    data: {
      quota_gb?: number;
      speed_mbps?: number;
      duration_days?: number;
      max_connections?: number;
      enabled?: boolean;
    }
  ) =>
    req<{ ok: boolean; error?: string }>(
      "/users/" + encodeURIComponent(name),
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    ),`;

c = c.substring(0, idx + endIdx) + insert + c.substring(idx + endIdx);
fs.writeFileSync(path, c, "utf-8");
console.log("OK");
