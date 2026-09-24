// Node Manager API client.

const BASE = "/api/nodes";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const cleanPath = path === "/" || path === "" ? "" : path;
  const res = await fetch(`${BASE}${cleanPath}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface NodeListItem {
  id: string;
  name: string;
  location: string;
  connected: boolean;
  info: {
    hostname?: string;
    platform?: string;
    arch?: string;
    cpuCount?: number;
    memoryMb?: number;
    uptime?: number;
  } | null;
  lastHeartbeat: number | null;
  connectedAt: number | null;
}

export interface TaskResult<T = unknown> {
  type: string;
  id: string;
  ok: boolean;
  output?: T;
  error?: string;
}

export interface ServiceStates {
  services: Record<string, string>;
}

export const nodesApi = {
  list: () => req<NodeListItem[]>(""),

  info: (id: string) =>
    req<TaskResult<Record<string, unknown>>>(`/${id}/info`),

  services: (id: string) =>
    req<TaskResult<ServiceStates>>(`/${id}/services`),

  disk: (id: string) =>
    req<TaskResult<{ stdout: string }>>(`/${id}/disk`),

  cpu: (id: string) =>
    req<TaskResult<{ stdout: string }>>(`/${id}/cpu`),

  uptime: (id: string) =>
    req<TaskResult<{ stdout: string }>>(`/${id}/uptime`),

  restartService: (id: string, service: string) =>
    req<TaskResult<{ stdout: string }>>(`/${id}/services/${service}/restart`, {
      method: "POST",
    }),

  serviceStatus: (id: string, service: string) =>
    req<TaskResult<{ stdout: string }>>(`/${id}/services/${service}/status`),
};
