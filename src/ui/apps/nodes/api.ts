// Node Manager API client.

const BASE = "/api/nodes";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const cleanPath = path === "/" || path === "" ? "" : path;
  const url = cleanPath.startsWith("/api/") ? cleanPath : BASE + cleanPath;
  const res = await fetch(url, {
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



export interface NodeMetrics {
  cpu_pct: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_free_mb: number;
  ram_cached_mb: number;
  ram_pct: number;
  disk_total_mb: number;
  disk_used_mb: number;
  disk_pct: number;
  load_1m: number;
  load_5m: number;
  load_15m: number;
  uptime_sec: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  process_count: number;
}

export interface NodeMetricsResult {
  id: string;
  display_name: string;
  flag: string;
  ip: string;
  ok: boolean;
  metrics: NodeMetrics | null;
  error: string | null;
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
  
  getMetrics: (id: string) =>
    req<{ ok: boolean; metrics: NodeMetrics }>(`/api/nodes-crud/${id}/metrics`),
  
  getAllMetrics: () =>
    req<{ ok: boolean; nodes: NodeMetricsResult[] }>("/api/nodes-crud/metrics/all"),
};
