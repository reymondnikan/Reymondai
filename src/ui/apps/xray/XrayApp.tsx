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

  const [newName, setNewName] = useState("");
  const [newQuota, setNewQuota] = useState(0);
  const [newSpeed, setNewSpeed] = useState(0);
  const [newDays, setNewDays] = useState(0);
  const [newMaxConn, setNewMaxConn] = useState(0);
  const [editingUser, setEditingUser] = useState<XrayUser | null>(null);
  const [editForm, setEditForm] = useState({
    quota_gb: 0,
    speed_mbps: 0,
    duration_days: 0,
    max_connections: 0,
    enabled: true,
  });
  const [editSaving, setEditSaving] = useState(false);
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
      const res = await xrayApi.addUser(name, newQuota, newSpeed, newDays, newMaxConn);
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
        setNewMaxConn(0);
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
    if (!confirm("حذف کاربر " + name + "")) return;
    try {
      await xrayApi.removeUser(name);
      await load();
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  
  const copyUserPageUrl = async (name: string) => {
    try {
      const res = await xrayApi.getUserPageUrl(name);
      if (res.ok && res.url) {
        await navigator.clipboard.writeText(res.url);
        setCopied("page_" + name);
        setTimeout(() => setCopied(null), 1500);
      }
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
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
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await xrayApi.syncStats();
      await load();
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSyncing(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  
  const openEdit = (u: XrayUser) => {
    setEditingUser(u);
    setEditForm({
      quota_gb: u.quota_gb,
      speed_mbps: u.speed_mbps,
      duration_days: u.duration_days || 0,
      max_connections: u.max_connections,
      enabled: u.enabled,
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      const res = await xrayApi.updateUser(editingUser.name, editForm);
      if (res.ok) {
        setEditingUser(null);
        await load();
      } else {
        alert("خطا: " + (res.error ?? "unknown"));
      }
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEditSaving(false);
    }
  };

if (loading) {
    return (
      <div className="xray-app">
        <div className="xray-loading">در حال بارگذاری…</div>
      </div>
    );
  }

  // Stats summary
  const totalUsed = users.reduce((a, u) => a + u.used_bytes, 0);
  const activeUsers = users.filter(
    (u) => u.enabled && (!u.expires_at || u.expires_at > Date.now())
  ).length;

  return (
    <div className="xray-app">
      {/* Header */}
      <div className="xray-header">
        <div className="xray-header-left">
          <h2>مدیریت پروکسی Xray</h2>
          {server && (
            <span className="xray-server-badge">
              <span className="xray-server-dot"></span>
              {server.ip}:{server.port}
            </span>
          )}
        </div>
        <button
          className="xray-sync-btn"
          onClick={syncNow}
          disabled={syncing}
        >
          {syncing ? "در حال sync…" : "بهروزرسانی"}
        </button>
      </div>

      {/* Stats cards */}
      <div className="xray-stats">
        <div className="xray-stat-card">
          <div className="xray-stat-label">کاربران</div>
          <div className="xray-stat-value">{users.length}</div>
          <div className="xray-stat-sub">{activeUsers} فعال</div>
        </div>
        <div className="xray-stat-card">
          <div className="xray-stat-label">مصرف کل</div>
          <div className="xray-stat-value">{formatBytes(totalUsed)}</div>
          <div className="xray-stat-sub">از همه کاربران</div>
        </div>
        <div className="xray-stat-card">
          <div className="xray-stat-label">پروتکل</div>
          <div className="xray-stat-value">VLESS</div>
          <div className="xray-stat-sub">Reality + TCP</div>
        </div>
      </div>

      {error && <div className="xray-error">{error}</div>}

      {/* Add user form */}
      <div className="xray-section">
        <h3>افزودن کاربر جدید</h3>
        <div className="xray-form-grid">
          <div className="xray-form-field">
            <label>نام کاربر</label>
            <input
              type="text"
              placeholder="مثلا ali-phone"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div className="xray-form-field">
            <label>حجم (GB)</label>
            <input
              type="number"
              placeholder="0 = بینهایت"
              value={newQuota || ""}
              onChange={(e) => setNewQuota(parseInt(e.target.value) || 0)}
              min={0}
              disabled={creating}
            />
          </div>
          <div className="xray-form-field">
            <label>سرعت (Mbps)</label>
            <input
              type="number"
              placeholder="0 = بینهایت"
              value={newSpeed || ""}
              onChange={(e) => setNewSpeed(parseInt(e.target.value) || 0)}
              min={0}
              disabled={creating}
            />
          </div>
          <div className="xray-form-field">
            <label>مدت (روز)</label>
            <input
              type="number"
              placeholder="0 = بینهایت"
              value={newDays || ""}
              onChange={(e) => setNewDays(parseInt(e.target.value) || 0)}
              min={0}
              disabled={creating}
            />
          </div>

          <div className="xray-form-field">
            <label>حداکثر دستگاه (0=بی‌نهایت)</label>
            <input
              type="number"
              placeholder="0 = بی‌نهایت"
              value={newMaxConn || ""}
              onChange={(e) => setNewMaxConn(parseInt(e.target.value) || 0)}
              min={0}
              disabled={creating}
            />
          </div>
        </div>
        <button
          className="xray-create-btn"
          onClick={create}
          disabled={creating || !newName.trim()}
        >
          {creating ? "در حال ساخت…" : "ساخت کاربر"}
        </button>
      </div>

      {/* Users list */}
      <div className="xray-section">
        <h3>کاربران ({users.length})</h3>
        {users.length === 0 ? (
          <div className="xray-empty">هنوز کاربری نساختهای</div>
        ) : (
          <div className="xray-users-list">
            {users.map((u) => {
              const usedGb = u.used_bytes / (1024 * 1024 * 1024);
              const percent =
                u.quota_gb > 0
                  ? Math.min(100, (usedGb / u.quota_gb) * 100)
                  : 0;
              const isWarning = percent > 80 && percent < 100;
              const isFull = u.quota_gb > 0 && usedGb >= u.quota_gb;
              const isUnlimited = u.quota_gb === 0;

              const daysLeft =
                u.expires_at && u.expires_at > Date.now()
                  ? Math.ceil((u.expires_at - Date.now()) / 86400000)
                  : null;
              const expired = u.expires_at && u.expires_at < Date.now();
              const status: "active" | "warn" | "expired" | "full" = expired
                ? "expired"
                : isFull
                ? "full"
                : isWarning
                ? "warn"
                : "active";

              return (
                <div key={u.id} className={"xray-user-card xray-user-" + status}>
                  <div className="xray-user-avatar">
                    {u.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="xray-user-body">
                    <div className="xray-user-header">
                      <span className="xray-user-name">{u.name}</span>
                      <span className={"xray-user-status-badge xray-status-" + status}>
                        {status === "active" && "فعال"}
                        {status === "warn" && "هشدار"}
                        {status === "full" && "پُر"}
                        {status === "expired" && "منقضی"}
                      </span>
                    </div>

                    <div className="xray-user-uuid">
                      {u.uuid.substring(0, 8)}…{u.uuid.substring(u.uuid.length - 4)}
                    </div>

                    <div className="xray-progress-row">
                      <div className="xray-progress-bar">
                        <div
                          className={"xray-progress-fill xray-progress-" + status}
                          style={{ width: percent + "%" }}
                        />
                      </div>
                      <div className="xray-progress-text">
                        {isUnlimited
                          ? formatBytes(u.used_bytes) + " / بینهایت"
                          : formatBytes(u.used_bytes) + " / " + u.quota_gb + " GB"}
                      </div>
                    </div>

                    <div className="xray-user-details">
                      <div className="xray-detail">
                        <span className="xray-detail-icon">⚡</span>
                        <span>{formatSpeed(u.speed_mbps)}</span>
                      </div>
                      <div className="xray-detail">
                        <span className="xray-detail-icon">📅</span>
                        <span>
                          {u.expires_at
                            ? daysLeft !== null
                              ? daysLeft + " روز مانده"
                              : "منقضی"
                            : "بینهایت"}
                        </span>
                      </div>
                      <div className="xray-detail">
                        <span className="xray-detail-icon">📊</span>
                        <span>
                          {u.quota_gb > 0 ? percent.toFixed(1) + "%" : "—"}
                        </span>
                      </div>

                      <div className="xray-detail">
                        <span className="xray-detail-icon">📱</span>
                        <span>
                          {u.max_connections > 0 
                            ? "حداکثر " + u.max_connections + " دستگاه"
                            : "بی‌نهایت دستگاه"}
                        </span>
                      </div>
                                        </div>
                  </div>

                  <div className="xray-user-actions-vertical">
                    <button
                      className="xray-action-btn xray-action-primary"
                      onClick={() => showLink(u)}
                    >
                      دریافت
                    </button>

                    <button
                      className="xray-action-btn xray-action-edit"
                      onClick={() => openEdit(u)}
                      title="ویرایش"
                    >
                      ویرایش
                    </button>
                    <button
                      className="xray-action-btn xray-action-page"
                      onClick={() => copyUserPageUrl(u.name)}
                      title="کپی لینک صفحه کاربر"
                    >
                      {copied === "page_" + u.name ? "✓" : "📱 صفحه"}
                    </button>
                    <button
                      className="xray-action-btn xray-action-danger"
                      onClick={() => remove(u.name)}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {linkModal && (
        <div className="xray-modal-backdrop" onClick={() => setLinkModal(null)}>
          <div className="xray-modal" onClick={(e) => e.stopPropagation()}>
            <div className="xray-modal-header">
              <h3>اطلاعات اتصال</h3>
              <div className="xray-modal-username">{linkModal.name}</div>
              <button
                className="xray-modal-close"
                onClick={() => setLinkModal(null)}
              >
                ✕
              </button>
            </div>

            {linkModal.sub && (
              <div className="xray-modal-section">
                <div className="xray-modal-label">
                  🔗 لینک اشتراک
                  <span className="xray-modal-recommended">
                    پیشنهاد میشود
                  </span>
                </div>
                <div className="xray-modal-value">{linkModal.sub}</div>
                <div className="xray-modal-actions">
                  <button
                    onClick={() => copy(linkModal.sub, "sub")}
                    className="xray-modal-btn xray-modal-btn-primary"
                  >
                    {copied === "sub" ? "✓ کپی شد" : "کپی لینک اشتراک"}
                  </button>
                  <a
                    href={
                      "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" +
                      encodeURIComponent(linkModal.sub)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="xray-modal-btn xray-modal-btn-secondary"
                  >
                    QR Code
                  </a>
                </div>
                <div className="xray-modal-hint">
                  این لینک رو توی V2Box Hiddify یا هر کلاینت Subscription
                  import کن. حجم و تاریخ انقضا خودکار نمایش داده میشه.
                </div>
              </div>
            )}

            <div className="xray-modal-divider" />

            <div className="xray-modal-section">
              <div className="xray-modal-label">📋 کانفیگ VLESS</div>
              <div className="xray-modal-value xray-modal-value-small">
                {linkModal.vless}
              </div>
              <div className="xray-modal-actions">
                <button
                  onClick={() => copy(linkModal.vless, "vless")}
                  className="xray-modal-btn xray-modal-btn-secondary"
                >
                  {copied === "vless" ? "✓ کپی شد" : "کپی کانفیگ"}
                </button>
                <a
                  href={
                    "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" +
                    encodeURIComponent(linkModal.vless)
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="xray-modal-btn xray-modal-btn-secondary"
                >
                  QR Code
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="xray-modal-backdrop" onClick={() => setEditingUser(null)}>
          <div className="xray-modal" onClick={(e) => e.stopPropagation()}>
            <div className="xray-modal-header">
              <h3>ویرایش کاربر</h3>
              <div className="xray-modal-username">{editingUser.name}</div>
              <button
                className="xray-modal-close"
                onClick={() => setEditingUser(null)}
              >
                ✕
              </button>
            </div>

            <div className="shop-form">
              <label>
                حجم (GB)
                <input
                  type="number"
                  value={editForm.quota_gb}
                  onChange={(e) => setEditForm({ ...editForm, quota_gb: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </label>

              <label>
                سرعت (Mbps)
                <input
                  type="number"
                  value={editForm.speed_mbps}
                  onChange={(e) => setEditForm({ ...editForm, speed_mbps: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </label>

              <label>
                مدت (روز)
                <input
                  type="number"
                  value={editForm.duration_days}
                  onChange={(e) => setEditForm({ ...editForm, duration_days: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </label>

              <label>
                حداکثر دستگاه
                <input
                  type="number"
                  value={editForm.max_connections}
                  onChange={(e) => setEditForm({ ...editForm, max_connections: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </label>

              <label style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={editForm.enabled}
                  onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <span>فعال</span>
              </label>
            </div>

            <div className="xray-modal-actions">
              <button
                className="xray-modal-btn xray-modal-btn-primary"
                onClick={saveEdit}
                disabled={editSaving}
              >
                {editSaving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </button>
              <button
                className="xray-modal-btn xray-modal-btn-secondary"
                onClick={() => setEditingUser(null)}
              >
                لغو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
