import { useEffect, useState } from "react";
import { api, type ProviderInfo } from "../lib/api";

interface Props {
  onBack: () => void;
}

interface Health {
  ok: boolean;
  app: string;
  env: string;
  time: number;
}

export function Dashboard({ onBack }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [caps, setCaps] = useState<unknown>(null);
  const [ops, setOps] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, p, c, o] = await Promise.all([
          api.health(),
          api.listProviders(),
          fetch("/api/system/capabilities").then((r) => r.json()),
          fetch("/api/system/operations").then((r) => r.json()),
        ]);
        setHealth(h);
        setProviders(p);
        setCaps(c);
        setOps(Array.isArray(o) ? o : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  return (
    <div className="dashboard">
      <button
        onClick={onBack}
        style={{ color: "var(--text-dim)", marginBottom: 12 }}
      >
        ← Back to chat
      </button>

      <h2>Control Panel</h2>

      {error && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <strong style={{ color: "var(--danger)" }}>Error:</strong> {error}
        </div>
      )}

      <div className="card">
        <h3>System</h3>
        <div className="kv"><span className="k">App</span><span>{health?.app ?? "—"}</span></div>
        <div className="kv"><span className="k">Environment</span><span>{health?.env ?? "—"}</span></div>
        <div className="kv"><span className="k">Status</span>
          <span style={{ color: health?.ok ? "var(--ok)" : "var(--danger)" }}>
            {health?.ok ? "● Healthy" : "● Offline"}
          </span>
        </div>
      </div>

      <div className="card">
        <h3>AI Providers</h3>
        {providers.map((p) => (
          <div key={p.id} className="provider-row">
            <div>
              <div className="provider-name">{p.name}</div>
              <div className="provider-desc">{p.description}</div>
            </div>
            <span className={`badge ${p.available ? "ok" : "off"}`}>
              {p.available ? "Ready" : "Not configured"}
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Capabilities</h3>
        {caps && typeof caps === "object" && "registered" in caps ? (
          <div className="kv">
            <span className="k">Registered</span>
            <span>{(caps as { registered: unknown[] }).registered.length} module(s)</span>
          </div>
        ) : (
          <div className="provider-desc">No data</div>
        )}
      </div>

      <div className="card">
        <h3>Recent Operations</h3>
        {ops.length === 0 ? (
          <div className="provider-desc">No operations yet</div>
        ) : (
          <div className="provider-desc">{ops.length} operation(s)</div>
        )}
      </div>

      <div className="card">
        <h3>Roadmap</h3>
        <div className="provider-desc">
          v0.2 — Telegram + X capability, event routing between them<br />
          v0.3 — Data platform, search, knowledge<br />
          v0.4 — Local AI (Ollama), VPN module<br />
          v0.5 — Multi-node fabric
        </div>
      </div>
    </div>
  );
}
