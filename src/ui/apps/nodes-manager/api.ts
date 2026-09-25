// Nodes Manager API client.

const BASE = "/api/nodes-list";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const cleanPath = path === "/" ? "" : path;
  const res = await fetch(BASE + cleanPath, {
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

export interface NodeItem {
  id: string;
  name: string;
  display_name: string | null;
  ip: string;
  port: number;
  sni: string;
  public_key: string | null;
  short_id: string | null;
  location: string | null;
  enabled: number;
  sort_order: number;
  created_at: number;
}

export const nodesListApi = {
  list: () => req<{ ok: boolean; nodes: NodeItem[] }>(""),

  create: (data: Partial<NodeItem>) =>
    req<{ ok: boolean; id: string; error?: string }>("", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<NodeItem>) =>
    req<{ ok: boolean; error?: string }>("/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    req<{ ok: boolean; error?: string }>("/" + id, { method: "DELETE" }),
};
