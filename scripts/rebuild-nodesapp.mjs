import fs from "node:fs";

const path = "src/ui/apps/nodes/NodesApp.tsx";
const c = fs.readFileSync(path, "utf-8");

// Extract pieces we want to keep:
// 1. The MetricsView, MetricsCard, MetricRow, formatMb, formatBytes functions
// 2. The NodeDetail function
// We'll rewrite the whole file structure.

// Find MetricsView start
const metricsStart = c.indexOf("// ============================================================\n// Metrics View");
const metricsEnd = c.indexOf("export function NodesApp");

// Find NodeDetail
const detailStart = c.indexOf("function NodeDetail(");
const detailEnd = c.lastIndexOf("}\n");

// Extract MetricsView content
let metricsContent = "";
if (metricsStart !== -1 && metricsEnd !== -1) {
  metricsContent = c.substring(metricsStart, metricsEnd);
}

// Extract NodeDetail content
let detailContent = "";
if (detailStart !== -1) {
  detailContent = c.substring(detailStart);
}

// Now build the new file
const newFile = `import { useEffect, useState, useCallback } from "react";
import { nodesApi, type NodeListItem, type ServiceStates, type NodeMetrics, type NodeMetricsResult } from "./api";

export function NodesApp() {
  const [nodes, setNodes] = useState<NodeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"nodes" | "metrics">("nodes");

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await nodesApi.list();
      setNodes(list);
      if (list.length > 0 && !selected) setSelected(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
    const iv = window.setInterval(load, 15000);
    return () => window.clearInterval(iv);
  }, [load]);

  return (
    <div className="nodes-app">
      <div className="nodes-tabs">
        <button
          className={"nodes-tab " + (activeTab === "nodes" ? "active" : "")}
          onClick={() => setActiveTab("nodes")}
        >
          🖥️ Nodes
        </button>
        <button
          className={"nodes-tab " + (activeTab === "metrics" ? "active" : "")}
          onClick={() => setActiveTab("metrics")}
        >
          📊 Metrics
        </button>
      </div>

      {activeTab === "metrics" ? (
        <MetricsView />
      ) : loading ? (
        <div className="nodes-loading">Loading nodes</div>
      ) : error ? (
        <div className="nodes-error">Error: {error}</div>
      ) : nodes.length === 0 ? (
        <div className="nodes-empty">No nodes registered.</div>
      ) : (
        <div className="nodes-nodes-view">
          <div className="nodes-list">
            {nodes.map((n) => (
              <div
                key={n.id}
                className={"node-card " + (n.id === selected ? "active" : "")}
                onClick={() => setSelected(n.id)}
              >
                <div className="node-card-header">
                  <span className={"node-status-dot " + (n.connected ? "online" : "offline")} />
                  <span className="node-card-name">{n.name}</span>
                </div>
                <div className="node-card-meta">
                  <span>{n.location}</span>
                  <span>{n.info?.cpuCount ?? "?"} CPU · {n.info?.memoryMb ?? "?"} MB</span>
                </div>
                <div className="node-card-id">{n.id}</div>
              </div>
            ))}
          </div>

          <div className="nodes-detail">
            {selected && <NodeDetail nodeId={selected} onRefresh={load} />}
          </div>
        </div>
      )}
    </div>
  );
}

${metricsContent}

${detailContent}
`;

fs.writeFileSync(path, newFile, "utf-8");
console.log("File rewritten:", newFile.length, "bytes");
