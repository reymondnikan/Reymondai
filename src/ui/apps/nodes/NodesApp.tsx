import { useEffect, useState, useCallback } from "react";
import { nodesApi, type NodeListItem, type ServiceStates } from "./api";

export function NodesApp() {
  const [nodes, setNodes] = useState<NodeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

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
    const iv = window.setInterval(load, 15000); // refresh every 15s
    return () => window.clearInterval(iv);
  }, [load]);

  if (loading) {
    return <div className="nodes-app"><div className="nodes-loading">Loading nodes</div></div>;
  }

  if (error) {
    return <div className="nodes-app"><div className="nodes-error">Error: {error}</div></div>;
  }

  if (nodes.length === 0) {
    return <div className="nodes-app"><div className="nodes-empty">No nodes registered.</div></div>;
  }

  return (
    <div className="nodes-app">
      <div className="nodes-list">
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`node-card ${n.id === selected ? "active" : ""}`}
            onClick={() => setSelected(n.id)}
          >
            <div className="node-card-header">
              <span className={`node-status-dot ${n.connected ? "online" : "offline"}`} />
              <span className="node-card-name">{n.name}</span>
            </div>
            <div className="node-card-meta">
              <span>{n.location}</span>
              <span>{n.info?.cpuCount ?? "?"} CPU  {n.info?.memoryMb ?? "?"} MB</span>
            </div>
            <div className="node-card-id">{n.id}</div>
          </div>
        ))}
      </div>

      <div className="nodes-detail">
        {selected && <NodeDetail nodeId={selected} onRefresh={load} />}
      </div>
    </div>
  );
}

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
    if (!confirm(`Restart ${svc}?`)) return;
    setBusy(svc);
    try {
      await nodesApi.restartService(nodeId, svc);
      await new Promise((r) => setTimeout(r, 2000));
      await reload();
      onRefresh();
    } catch (e) {
      alert(`Restart failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return <div className="nodes-error">Error: {error}</div>;
  }

  return (
    <div className="node-detail-content">
      <h2>{String(info?.hostname ?? nodeId)}</h2>

      <div className="node-section">
        <h3>System</h3>
        <div className="node-kv"><span>OS</span><span>{String(info?.platform ?? "?")} {String(info?.release ?? "")}</span></div>
        <div className="node-kv"><span>Architecture</span><span>{String(info?.arch ?? "?")}</span></div>
        <div className="node-kv"><span>CPU Model</span><span className="node-kv-truncate">{String(info?.cpuModel ?? "?")}</span></div>
        <div className="node-kv"><span>CPU Cores</span><span>{String(info?.cpuCount ?? "?")}</span></div>
        <div className="node-kv"><span>Node Version</span><span>{String(info?.nodeVersion ?? "?")}</span></div>
      </div>

      <div className="node-section">
        <h3>Services</h3>
        {services ? (
          Object.entries(services).map(([name, status]) => (
            <div key={name} className="node-service-row">
              <div className="node-service-info">
                <span className={`node-status-dot ${status === "active" ? "online" : "offline"}`} />
                <span className="node-service-name">{name}</span>
                <span className="node-service-status">{status}</span>
              </div>
              <button
                className="node-restart-btn"
                onClick={() => restart(name)}
                disabled={busy === name}
                title={`Restart ${name}`}
              >
                {busy === name ? "" : "Restart"}
              </button>
            </div>
          ))
        ) : (
          <div className="node-loading-text">Loading</div>
        )}
      </div>

      <div className="node-section">
        <h3>Disk</h3>
        {disk ? (
          <pre className="node-pre">{disk}</pre>
        ) : (
          <div className="node-loading-text">Loading</div>
        )}
      </div>

      <div className="node-section">
        <h3>Uptime</h3>
        {uptime ? (
          <pre className="node-pre">{uptime}</pre>
        ) : (
          <div className="node-loading-text">Loading</div>
        )}
      </div>
    </div>
  );
}
