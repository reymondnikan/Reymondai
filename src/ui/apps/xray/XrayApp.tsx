import { useEffect, useState, useCallback } from "react";
import {
  xrayApi,
  formatBytes,
  formatQuota,
  formatSpeed,
  type XrayUser,
  type ServerInfo,
} from "./api";

export function XrayApp() {
  const [users, setUsers] = useState<XrayUser[]>([]);
  const [server, setServer] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Form state
  const [newName, setNewName] = useState("");
  const [newQuota, setNewQuota] = useState(0);
  const [newSpeed, setNewSpeed] = useState(0);
  const [creating, setCreating] = useState(false);

  const [createdLink, setCreatedLink] = useState<{ name: string; link: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [usersRes, serverRes] = await Promise.all([
        xrayApi.listUsers(),
        xrayApi.server(),
      ]);
      if (usersRes.ok) setUsers(usersRes.users);
      setServer(serverRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Auto sync stats every 60 seconds
    const iv = window.setInterval(async () => {
      try {
        await xrayApi.syncStats();
        await load();
      } catch {}
    }, 60000);
    return () => window.clearInterval(iv);
  }, [load]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await xrayApi.addUser(name, newQuota, newSpeed);
      if (res.ok) {
        setCreatedLink({ name, link: res.link });
        setNewName("");
        setNewQuota(0);
        setNewSpeed(0);
        await load();
      } else {
        setError(res.error ?? "create failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try {
      await xrayApi.removeUser(name);
      await load();
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const showLink = async (name: string) => {
    try {
      const res = await xrayApi.getLink(name);
      if (res.ok) setCreatedLink({ name, link: res.link });
    } catch (e) {
      alert(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await xrayApi.syncStats();
      await load();
    } catch (e) {
      alert(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="xray-app">
        <div className="xray-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="xray-app">
      <div className="xray-header">
        <h2>Xray Proxy Management</h2>
        <div className="xray-header-actions">
          <button
            className="xray-sync-btn"
            onClick={syncNow}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync stats"}
          </button>
          {server && (
            <span className="xray-server-badge">
              {server.ip}:{server.port}
            </span>
          )}
        </div>
      </div>

      {error && <div className="xray-error">{error}</div>}

      {/* Create new user */}
      <div className="xray-section">
        <h3>Add user</h3>
        <div className="xray-create-form">
          <input
            type="text"
            placeholder="User name (e.g. ali-phone)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={creating}
          />
          <input
            type="number"
            placeholder="Quota (GB, 0=∞)"
            value={newQuota || ""}
            onChange={(e) => setNewQuota(parseInt(e.target.value) || 0)}
            min={0}
            disabled={creating}
            className="xray-num-input"
          />
          <input
            type="number"
            placeholder="Speed (Mbps, 0=∞)"
            value={newSpeed || ""}
            onChange={(e) => setNewSpeed(parseInt(e.target.value) || 0)}
            min={0}
            disabled={creating}
            className="xray-num-input"
          />
          <button onClick={create} disabled={creating || !newName.trim()}>
            {creating ? "…" : "Create"}
          </button>
        </div>
      </div>

      {/* New link display */}
      {createdLink && (
        <div className="xray-link-box">
          <div className="xray-link-header">
            <span className="xray-link-title">
              Link for <strong>{createdLink.name}</strong>
            </span>
            <button
              className="xray-link-close"
              onClick={() => setCreatedLink(null)}
            >
              ✕
            </button>
          </div>

          <div className="xray-link-text">{createdLink.link}</div>

          <div className="xray-link-actions">
            <button onClick={() => copy(createdLink.link, "link")}>
              {copied === "link" ? "✓ Copied" : "Copy link"}
            </button>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(createdLink.link)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="xray-qr-link"
            >
              Show QR Code
            </a>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="xray-section">
        <h3>Users ({users.length})</h3>
        {users.length === 0 ? (
          <div className="xray-empty">No users yet. Create one above.</div>
        ) : (
          <div className="xray-users-list">
            {users.map((u) => {
              const usedGb = u.used_bytes / (1024 ** 3);
              const percent =
                u.quota_gb > 0 ? Math.min(100, (usedGb / u.quota_gb) * 100) : 0;
              const isWarning = percent > 80;
              const isFull = u.quota_gb > 0 && usedGb >= u.quota_gb;

              return (
                <div key={u.id} className="xray-user-row">
                  <div className="xray-user-main">
                    <div className="xray-user-info">
                      <div className="xray-user-name">
                        {u.name}
                        {isFull && (
                          <span className="xray-user-full">FULL</span>
                        )}
                        {!u.enabled && (
                          <span className="xray-user-disabled">DISABLED</span>
                        )}
                      </div>
                      <div className="xray-user-uuid">{u.uuid}</div>
                    </div>

                    {/* Quota bar */}
                    <div className="xray-quota-block">
                      <div className="xray-quota-info">
                        <span>
                          <strong>{formatBytes(u.used_bytes)}</strong>{" "}
                          / {formatQuota(u.quota_gb)}
                        </span>
                        <span className="xray-quota-percent">
                          {u.quota_gb > 0 ? `${percent.toFixed(1)}%` : ""}
                        </span>
                      </div>
                      {u.quota_gb > 0 && (
                        <div className="xray-quota-bar">
                          <div
                            className={`xray-quota-fill ${
                              isFull
                                ? "full"
                                : isWarning
                                ? "warn"
                                : ""
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Speed */}
                    <div className="xray-user-speed">
                      ⚡ Speed: {formatSpeed(u.speed_mbps)}
                    </div>
                  </div>

                  <div className="xray-user-actions">
                    <button
                      className="xray-btn-secondary"
                      onClick={() => showLink(u.name)}
                      title="Show link and QR"
                    >
                      Link
                    </button>
                    <button
                      className="xray-btn-danger"
                      onClick={() => remove(u.name)}
                      title="Delete user"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="xray-section xray-info">
        <h3>Note</h3>
        <p>
          Traffic stats sync automatically every 60 seconds, or click <strong>Sync stats</strong> for immediate update.
          Quota and speed limits enforcement will be added soon.
        </p>
      </div>
    </div>
  );
}
