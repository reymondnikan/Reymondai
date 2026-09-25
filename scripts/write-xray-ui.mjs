import fs from "node:fs";

const content = `import { useEffect, useState, useCallback } from "react";
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

  const [newName, setNewName] = useState("");
  const [newQuota, setNewQuota] = useState(0);
  const [newSpeed, setNewSpeed] = useState(0);
  const [newDays, setNewDays] = useState(0);
  const [creating, setCreating] = useState(false);

  const [linkModal, setLinkModal] = useState<{
    name: string;
    vless: string;
    sub: string;
    token: string;
  } | null>(null);

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
      const res = await xrayApi.addUser(name, newQuota, newSpeed, newDays);
      if (res.ok) {
        const token = res.user.public_token;
        const subUrl = token
          ? window.location.origin + "/api/xray/sub/" + token
          : "";
        setLinkModal({ name, vless: res.link, sub: subUrl, token: token || "" });
        setNewName("");
        setNewQuota(0);
        setNewSpeed(0);
        setNewDays(0);
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
    if (!confirm("Delete user " + name + "?")) return;
    try {
      await xrayApi.removeUser(name);
      await load();
    } catch (e) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const showLink = async (u: XrayUser) => {
    try {
      const res = await xrayApi.getLink(u.name);
      if (res.ok) {
        const subUrl = u.public_token
          ? window.location.origin + "/api/xray/sub/" + u.public_token
          : "";
        setLinkModal({
          name: u.name,
          vless: res.link,
          sub: subUrl,
          token: u.public_token ?? "",
        });
      }
    } catch (e) {
      alert("Failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await xrayApi.syncStats();
      await load();
    } catch (e) {
      alert("Sync failed: " + (e instanceof Error ? e.message : String(e)));
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
        <div className="xray-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="xray-app">
      <div className="xray-header">
        <h2>Xray Proxy Management</h2>
        <div className="xray-header-actions">
          <button className="xray-sync-btn" onClick={syncNow} disabled={syncing}>
            {syncing ? "..." : "Sync stats"}
          </button>
          {server && (
            <span className="xray-server-badge">
              {server.ip}:{server.port}
            </span>
          )}
        </div>
      </div>

      {error && <div className="xray-error">{error}</div>}

      <div className="xray-section">
        <h3>Add user</h3>
        <div className="xray-create-form">
          <input
            type="text"
            placeholder="User name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={creating}
          />
          <input
            type="number"
            placeholder="Quota GB"
            value={newQuota || ""}
            onChange={(e) => setNewQuota(parseInt(e.target.value) || 0)}
            min={0}
            disabled={creating}
            className="xray-num-input"
          />
          <input
            type="number"
            placeholder="Speed Mbps"
            value={newSpeed || ""}
            onChange={(e) => setNewSpeed(parseInt(e.target.value) || 0)}
            min={0}
            disabled={creating}
            className="xray-num-input"
          />
          <input
            type="number"
            placeholder="Days"
            value={newDays || ""}
            onChange={(e) => setNewDays(parseInt(e.target.value) || 0)}
            min={0}
            disabled={creating}
            className="xray-num-input"
          />
          <button onClick={create} disabled={creating || !newName.trim()}>
            {creating ? "..." : "Create"}
          </button>
        </div>
      </div>

      <div className="xray-section">
        <h3>Users ({users.length})</h3>
        {users.length === 0 ? (
          <div className="xray-empty">No users yet.</div>
        ) : (
          <div className="xray-users-list">
            {users.map((u) => {
              const usedGb = u.used_bytes / (1024 * 1024 * 1024);
              const percent = u.quota_gb > 0 ? Math.min(100, (usedGb / u.quota_gb) * 100) : 0;
              const isWarning = percent > 80;
              const isFull = u.quota_gb > 0 && usedGb >= u.quota_gb;

              const daysLeft =
                u.expires_at && u.expires_at > Date.now()
                  ? Math.ceil((u.expires_at - Date.now()) / 86400000)
                  : null;
              const expired = u.expires_at && u.expires_at < Date.now();

              return (
                <div key={u.id} className="xray-user-row">
                  <div className="xray-user-main">
                    <div className="xray-user-info">
                      <div className="xray-user-name">
                        {u.name}
                        {isFull && <span className="xray-user-full">FULL</span>}
                        {expired && <span className="xray-user-disabled">EXPIRED</span>}
                      </div>
                      <div className="xray-user-uuid">{u.uuid}</div>
                    </div>

                    <div className="xray-quota-block">
                      <div className="xray-quota-info">
                        <span>
                          <strong>{formatBytes(u.used_bytes)}</strong> / {formatQuota(u.quota_gb)}
                        </span>
                        <span className="xray-quota-percent">
                          {u.quota_gb > 0 ? percent.toFixed(1) + "%" : ""}
                        </span>
                      </div>
                      {u.quota_gb > 0 && (
                        <div className="xray-quota-bar">
                          <div
                            className={"xray-quota-fill " + (isFull ? "full" : isWarning ? "warn" : "")}
                            style={{ width: percent + "%" }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="xray-user-meta">
                      <span>Speed: {formatSpeed(u.speed_mbps)}</span>
                      <span>
                        {u.expires_at
                          ? daysLeft !== null
                            ? daysLeft + " روز مانده"
                            : "منقضی"
                          : "بی‌نهایت"}
                      </span>
                    </div>
                  </div>

                  <div className="xray-user-actions">
                    <button className="xray-btn-primary" onClick={() => showLink(u)}>
                      دریافت
                    </button>
                    <button className="xray-btn-danger" onClick={() => remove(u.name)}>
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {linkModal && (
        <div className="xray-modal-backdrop" onClick={() => setLinkModal(null)}>
          <div className="xray-modal" onClick={(e) => e.stopPropagation()}>
            <div className="xray-modal-header">
              <h3>اطلاعات اتصال — {linkModal.name}</h3>
              <button className="xray-modal-close" onClick={() => setLinkModal(null)}>
                ✕
              </button>
            </div>

            {linkModal.sub && (
              <div className="xray-modal-section">
                <div className="xray-modal-label">لینک اشتراک (V2Box)</div>
                <div className="xray-modal-value">{linkModal.sub}</div>
                <div className="xray-modal-actions">
                  <button onClick={() => copy(linkModal.sub, "sub")} className="xray-btn-primary">
                    {copied === "sub" ? "کپی شد" : "کپی لینک اشتراک"}
                  </button>
                  <a
                    href={"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(linkModal.sub)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="xray-btn-secondary"
                  >
                    QR
                  </a>
                </div>
                <div className="xray-modal-hint">
                  این لینک رو توی V2Box import کن. حجم و تاریخ خودکار نشون داده می‌شه.
                </div>
              </div>
            )}

            <div className="xray-modal-section">
              <div className="xray-modal-label">کانفیگ VLESS</div>
              <div className="xray-modal-value xray-modal-value-small">{linkModal.vless}</div>
              <div className="xray-modal-actions">
                <button onClick={() => copy(linkModal.vless, "vless")} className="xray-btn-secondary">
                  {copied === "vless" ? "کپی شد" : "کپی کانفیگ"}
                </button>
                <a
                  href={"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(linkModal.vless)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="xray-btn-secondary"
                >
                  QR
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync("src/ui/apps/xray/XrayApp.tsx", content, "utf-8");
console.log("OK", content.length);
