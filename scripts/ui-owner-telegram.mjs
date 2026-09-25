import fs from "node:fs";

const path = "src/ui/apps/xray/api.ts";
let c = fs.readFileSync(path, "utf-8");

if (!c.includes("owner_telegram_id")) {
  c = c.replace(
    /(max_connections: number;)/,
    `$1
  owner_telegram_id: string | null;`
  );
  fs.writeFileSync(path, c, "utf-8");
  console.log("api.ts updated");
} else {
  console.log("already has owner_telegram_id");
}
