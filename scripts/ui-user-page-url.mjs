import fs from "node:fs";

const path = "src/ui/apps/xray/api.ts";
let c = fs.readFileSync(path, "utf-8");

if (!c.includes("getUserPageUrl")) {
  // اضافه کردن متد
  c = c.replace(
    /(getLink: \(name: string\) =>[\s\S]*?\),)/,
    `$1
  
  getUserPageUrl: (name: string) =>
    req<{ ok: boolean; url: string; token: string }>(
      "/users/" + encodeURIComponent(name) + "/page-url"
    ),`
  );
  fs.writeFileSync(path, c, "utf-8");
  console.log("api.ts updated");
} else {
  console.log("already has getUserPageUrl");
}
