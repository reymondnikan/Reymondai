import { useEffect, useState, useCallback } from "react";
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


// ============================================================
// Node Detail — view for one node
// ============================================================
function NodeDetail({ nodeId, onRefresh }: { nodeId: string; onRefresh: () => void }) {
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [services, setServices] = useState<ServiceStates["services"] | null>(null);
  const [disk, setDisk] = useState<string | null>(null);
  const [uptime, setUptime] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [infoRes, svcRes, diskRes, upRes] = await Promise.all([
        nodesApi.info(nodeId),
        nodesApi.services(nodeId),
        nodesApi.disk(nodeId),
        nodesApi.uptime(nodeId),
      ]);
      if (infoRes.ok) setInfo(infoRes.output as Record<string, unknown>);
      if (svcRes.ok && svcRes.output) setServices(svcRes.output.services);
      if (diskRes.ok && diskRes.output) setDisk(diskRes.output.stdout);
      if (upRes.ok && upRes.output) setUptime(upRes.output.stdout);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [nodeId]);

  useEffect(() => {
    reload();
    const iv = window.setInterval(reload, 20000);
    return () => window.clearInterval(iv);
  }, [reload]);

  const restart = async (svc: string) => {
    if (!confirm("ریستارت " + svc + "?")) return;
    setBusy(svc);
    try {
      await nodesApi.restartService(nodeId, svc);
      await new Promise((r) => setTimeout(r, 2000));
      await reload();
      onRefresh();
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return <div className="nodes-error">خطا: {error}</div>;
  }

  return (
    <div className="node-detail-content">
      <h2>{String(info?.hostname ?? nodeId)}</h2>

      <div className="node-section">
        <h3>سیستم</h3>
        <div className="node-kv"><span>OS</span><span>{String(info?.platform ?? "?")} {String(info?.release ?? "")}</span></div>
        <div className="node-kv"><span>Architecture</span><span>{String(info?.arch ?? "?")}</span></div>
        <div className="node-kv"><span>CPU Model</span><span className="node-kv-truncate">{String(info?.cpuModel ?? "?")}</span></div>
        <div className="node-kv"><span>CPU Cores</span><span>{String(info?.cpuCount ?? "?")}</span></div>
        <div className="node-kv"><span>Node Version</span><span>{String(info?.nodeVersion ?? "?")}</span></div>
      </div>

      <div className="node-section">
        <h3>سرویس‌ها</h3>
        {services ? (
          Object.entries(services).map(([name, status]) => (
            <div key={name} className="node-service-row">
              <div className="node-service-info">
                <span className={"node-status-dot " + (status === "active" ? "online" : "offline")} />
                <span className="node-service-name">{name}</span>
                <span className="node-service-status">{status}</span>
              </div>
              <button
                className="node-restart-btn"
                onClick={() => restart(name)}
                disabled={busy === name}
              >
                {busy === name ? "…" : "ریستارت"}
              </button>
            </div>
          ))
        ) : (
          <div className="node-loading-text">…</div>
        )}
      </div>

      <div className="node-section">
        <h3>دیسک</h3>
        {disk ? <pre className="node-pre">{disk}</pre> : <div className="node-loading-text">…</div>}
      </div>

      <div className="node-section">
        <h3>Uptime</h3>
        {uptime ? <pre className="node-pre">{uptime}</pre> : <div className="node-loading-text">…</div>}
      </div>
    </div>
  );
}


// ============================================================
// Metrics View
// ============================================================
function MetricsView() {
  const [nodes, setNodes] = useState<NodeMetricsResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await nodesApi.getAllMetrics();
      if (res.ok) setNodes(res.nodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = window.setInterval(load, 10000);
    return () => window.clearInterval(iv);
  }, [load]);

  if (loading) return <div className="nodes-loading">در حال بارگذاری…</div>;
  if (error) return <div className="nodes-error">خطا: {error}</div>;

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <h3>📊 مانیتورینگ سرورها</h3>
        <button className="xray-sync-btn" onClick={load}>🔄 به‌روزرسانی</button>
      </div>
      <div className="metrics-grid">
        {nodes.map((n) => <MetricsCard key={n.id} node={n} />)}
      </div>
      <div className="metrics-note">⏱️ به‌روزرسانی خودکار هر ۱۰ ثانیه</div>
    </div>
  );
}

function MetricsCard({ node }: { node: NodeMetricsResult }) {
  if (!node.ok || !node.metrics) {
    return (
      <div className="metrics-card metrics-error">
        <div className="metrics-card-header">
          <span className="metrics-node-name">{node.flag} {node.display_name}</span>
          <span className="metrics-status-dot offline" />
        </div>
        <div className="metrics-error-msg">{node.error ?? "خطا"}</div>
      </div>
    );
  }
  const m = node.metrics;
  const uptimeDays = Math.floor(m.uptime_sec / 86400);
  const uptimeHours = Math.floor((m.uptime_sec % 86400) / 3600);
  return (
    <div className="metrics-card">
      <div className="metrics-card-header">
        <span className="metrics-node-name">{node.flag} {node.display_name}</span>
        <span className="metrics-status-dot online" />
      </div>
      <div className="metrics-node-ip">{node.ip}</div>
      <div className="metrics-rows">
        <MetricRow icon="🔥" label="CPU" value={m.cpu_pct} suffix="%" percent={m.cpu_pct} />
        <MetricRow icon="🧠" label="RAM" value={m.ram_pct} suffix="%" percent={m.ram_pct} extra={formatMb(m.ram_used_mb) + " / " + formatMb(m.ram_total_mb)} />
        <MetricRow icon="💾" label="دیسک" value={m.disk_pct} suffix="%" percent={m.disk_pct} extra={formatMb(m.disk_used_mb) + " / " + formatMb(m.disk_total_mb)} />
      </div>
      <div className="metrics-details">
        <div className="metrics-detail">
          <span className="metrics-detail-label">Load Avg</span>
          <span className="metrics-detail-value">{m.load_1m.toFixed(2)} / {m.load_5m.toFixed(2)} / {m.load_15m.toFixed(2)}</span>
        </div>
        <div className="metrics-detail">
          <span className="metrics-detail-label">Uptime</span>
          <span className="metrics-detail-value">{uptimeDays}d {uptimeHours}h</span>
        </div>
        <div className="metrics-detail">
          <span className="metrics-detail-label">Network</span>
          <span className="metrics-detail-value">⬇ {formatBytes(m.net_rx_bytes)} · ⬆ {formatBytes(m.net_tx_bytes)}</span>
        </div>
        <div className="metrics-detail">
          <span className="metrics-detail-label">Processes</span>
          <span className="metrics-detail-value">{m.process_count}</span>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value, suffix, percent, extra }: { icon: string; label: string; value: number; suffix: string; percent: number; extra?: string; }) {
  const status = percent > 90 ? "danger" : percent > 75 ? "warn" : "ok";
  return (
    <div className="metrics-row">
      <div className="metrics-row-header">
        <span className="metrics-row-label">{icon} {label}</span>
        <span className={"metrics-row-value metrics-value-" + status}>{value.toFixed(1)}{suffix}</span>
      </div>
      <div className="metrics-bar">
        <div className={"metrics-bar-fill metrics-bar-" + status} style={{ width: Math.min(100, percent) + "%" }} />
      </div>
      {extra && <div className="metrics-row-extra">{extra}</div>}
    </div>
  );
}

function formatMb(mb: number): string {
  if (mb >= 1024) return (mb / 1024).toFixed(1) + " GB";
  return mb + " MB";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
}

