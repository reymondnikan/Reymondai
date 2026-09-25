import fs from "node:fs";

const path = "src/ui/apps/nodes/NodesApp.tsx";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("function NodeDetail")) {
  console.log("NodeDetail already exists");
  process.exit(0);
}

const nodeDetail = `

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
`;

c = c.trimEnd() + "\n" + nodeDetail + "\n";

fs.writeFileSync(path, c, "utf-8");
console.log("NodeDetail added");
