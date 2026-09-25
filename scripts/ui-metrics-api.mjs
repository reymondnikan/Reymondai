import fs from "node:fs";

const path = "src/ui/apps/nodes/api.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("getMetrics")) {
  console.log("Already has metrics");
  process.exit(0);
}

// Add Metrics interfaces
const metricsInterface = `

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
`;

// Insert before "export const nodesApi"
const apiIdx = c.indexOf("export const nodesApi");
if (apiIdx !== -1) {
  c = c.substring(0, apiIdx) + metricsInterface + "\n" + c.substring(apiIdx);
}

// Add methods to nodesApi
c = c.replace(
  /(serviceStatus: \(id: string, service: string\) =>[\s\S]*?\),)/,
  `$1
  
  getMetrics: (id: string) =>
    req<{ ok: boolean; metrics: NodeMetrics }>(\`/api/nodes-crud/\${id}/metrics\`),
  
  getAllMetrics: () =>
    req<{ ok: boolean; nodes: NodeMetricsResult[] }>("/api/nodes-crud/metrics/all"),`
);

fs.writeFileSync(path, c, "utf-8");
console.log("api.ts updated");
