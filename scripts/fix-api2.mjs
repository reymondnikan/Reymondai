import fs from "node:fs";

const path = "src/ui/apps/xray/api.ts";
let c = fs.readFileSync(path, "utf-8");

// Find the xrayApi object
const apiStart = c.indexOf("export const xrayApi = {");
const apiEnd = c.indexOf("};", apiStart) + 2;

if (apiStart === -1 || apiEnd < apiStart) {
  console.log("ERROR: xrayApi not found");
  process.exit(1);
}

const newApi = `export const xrayApi = {
  server: () => req<ServerInfo>("/server"),
  listUsers: () => req<{ ok: boolean; users: XrayUser[] }>("/users"),
  addUser: (name: string, quota_gb: number, speed_mbps: number, duration_days: number, max_connections: number) =>
    req<CreateUserResponse>("/users", {
      method: "POST",
      body: JSON.stringify({ name, quota_gb, speed_mbps, duration_days, max_connections }),
    }),
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
    ),
  removeUser: (name: string) =>
    req<{ ok: boolean; error?: string }>(
      "/users/" + encodeURIComponent(name),
      { method: "DELETE" }
    ),
  getLink: (name: string) =>
    req<{ ok: boolean; link: string }>(
      "/users/" + encodeURIComponent(name) + "/link"
    ),
  syncStats: () =>
    req<{ ok: boolean; updated: number; users: number }>("/sync-stats", {
      method: "POST",
    }),
};`;

c = c.substring(0, apiStart) + newApi + c.substring(apiEnd);
fs.writeFileSync(path, c, "utf-8");
console.log("OK - xrayApi rewritten");
