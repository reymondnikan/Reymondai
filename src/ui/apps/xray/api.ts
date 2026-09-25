// Xray Control API client.

const BASE = "/api/xray";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(res.status + ": " + text.slice(0, 200));
  }
  return (await res.json()) as T;
}

export interface XrayUser {
  id: string;
  name: string;
  uuid: string;
  quota_gb: number;
  speed_mbps: number;
  used_bytes: number;
  enabled: boolean;
  created_at: number;
  expires_at: number | null;
  duration_days: number;
  max_connections: number;
  public_token: string | null;
}

export interface ServerInfo {
  ip: string;
  port: number;
  sni: string;
  publicKey: string;
  shortId: string;
}

export interface CreateUserResponse {
  ok: boolean;
  user: XrayUser;
  link: string;
  error?: string;
  synced?: boolean;
  syncError?: string;
}

export const xrayApi = {
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
  
  getUserPageUrl: (name: string) =>
    req<{ ok: boolean; url: string; token: string }>(
      "/users/" + encodeURIComponent(name) + "/page-url"
    ),
  syncStats: () =>
    req<{ ok: boolean; updated: number; users: number }>("/sync-stats", {
      method: "POST",
    }),
};

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return val.toFixed(2) + " " + sizes[i];
}

export function formatQuota(gb: number): string {
  if (gb === 0) return "Unlimited";
  return gb + " GB";
}

export function formatSpeed(mbps: number): string {
  if (mbps === 0) return "Unlimited";
  return mbps + " Mbps";
}
