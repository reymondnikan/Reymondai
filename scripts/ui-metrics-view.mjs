import fs from "node:fs";

const path = "src/ui/apps/nodes/NodesApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// چک کن قبلاً اضافه شده یا نه
if (c.includes("MetricsBar")) {
  console.log("Already has metrics UI");
  process.exit(0);
}

// 1. آپدیت import
c = c.replace(
  /import \{ nodesApi, type NodeListItem, type ServiceStates \} from "\.\/api";/,
  'import { nodesApi, type NodeListItem, type ServiceStates, type NodeMetrics, type NodeMetricsResult } from "./api";'
);

// 2. اضافه کردن MetricsView توی `NodesApp` (بعد از stats)
const metricsViewComponent = `

// ============================================================
// Metrics View — full server monitoring
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

  if (loading) {
    return <div className="nodes-loading">در حال بارگذاری…</div>;
  }

  if (error) {
    return <div className="nodes-error">خطا: {error}</div>;
  }

  return (
    <div className="metrics-view">
      <div className="metrics-header">
        <h3>📊 مانیتورینگ سرورها</h3>
        <button className="xray-sync-btn" onClick={load}>
          🔄 به‌روزرسانی
        </button>
      </div>

      <div className="metrics-grid">
        {nodes.map((n) => (
          <MetricsCard key={n.id} node={n} />
        ))}
      </div>

      <div className="metrics-note">
        ⏱️ به‌روزرسانی خودکار هر ۱۰ ثانیه
      </div>
    </div>
  );
}

// ============================================================
// Metrics Card for one node
// ============================================================
function MetricsCard({ node }: { node: NodeMetricsResult }) {
  if (!node.ok || !node.metrics) {
    return (
      <div className="metrics-card metrics-error">
        <div className="metrics-card-header">
          <span className="metrics-node-name">
            {node.flag} {node.display_name}
          </span>
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
        <span className="metrics-node-name">
          {node.flag} {node.display_name}
        </span>
        <span className="metrics-status-dot online" />
      </div>
      <div className="metrics-node-ip">{node.ip}</div>

      <div className="metrics-rows">
        <MetricRow
          icon="🔥"
          label="CPU"
          value={m.cpu_pct}
          suffix="%"
          percent={m.cpu_pct}
        />
        <MetricRow
          icon="🧠"
          label="RAM"
          value={m.ram_pct}
          suffix="%"
          percent={m.ram_pct}
          extra={formatMb(m.ram_used_mb) + " / " + formatMb(m.ram_total_mb)}
        />
        <MetricRow
          icon="💾"
          label="دیسک"
          value={m.disk_pct}
          suffix="%"
          percent={m.disk_pct}
          extra={formatMb(m.disk_used_mb) + " / " + formatMb(m.disk_total_mb)}
        />
      </div>

      <div className="metrics-details">
        <div className="metrics-detail">
          <span className="metrics-detail-label">Load Avg</span>
          <span className="metrics-detail-value">
            {m.load_1m.toFixed(2)} / {m.load_5m.toFixed(2)} / {m.load_15m.toFixed(2)}
          </span>
        </div>
        <div className="metrics-detail">
          <span className="metrics-detail-label">Uptime</span>
          <span className="metrics-detail-value">
            {uptimeDays}d {uptimeHours}h
          </span>
        </div>
        <div className="metrics-detail">
          <span className="metrics-detail-label">Network</span>
          <span className="metrics-detail-value">
            ⬇ {formatBytes(m.net_rx_bytes)} · ⬆ {formatBytes(m.net_tx_bytes)}
          </span>
        </div>
        <div className="metrics-detail">
          <span className="metrics-detail-label">Processes</span>
          <span className="metrics-detail-value">{m.process_count}</span>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  suffix,
  percent,
  extra,
}: {
  icon: string;
  label: string;
  value: number;
  suffix: string;
  percent: number;
  extra?: string;
}) {
  const status = percent > 90 ? "danger" : percent > 75 ? "warn" : "ok";
  return (
    <div className="metrics-row">
      <div className="metrics-row-header">
        <span className="metrics-row-label">
          {icon} {label}
        </span>
        <span className={"metrics-row-value metrics-value-" + status}>
          {value.toFixed(1)}
          {suffix}
        </span>
      </div>
      <div className="metrics-bar">
        <div
          className={"metrics-bar-fill metrics-bar-" + status}
          style={{ width: Math.min(100, percent) + "%" }}
        />
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
`;

// Insert before the last closing
const lastLine = c.lastIndexOf("export function");
if (lastLine !== -1) {
  // Find the end of the file's last function
  const insertAt = c.length - 2;
  c = c.substring(0, insertAt) + metricsViewComponent + "\n" + c.substring(insertAt);
}

fs.writeFileSync(path, c, "utf-8");
console.log("NodesApp.tsx updated with MetricsView");
