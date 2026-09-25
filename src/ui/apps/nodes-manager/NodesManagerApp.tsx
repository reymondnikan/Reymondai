import { useEffect, useState, useCallback } from "react";
import { nodesListApi, type NodeItem } from "./api";

export function NodesManagerApp() {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<NodeItem> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await nodesListApi.list();
      if (res.ok) setNodes(res.nodes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        const res = await nodesListApi.update(editing.id, editing);
        if (!res.ok) {
          alert("خطا: " + (res.error ?? "unknown"));
          return;
        }
      } else {
        const res = await nodesListApi.create(editing);
        if (!res.ok) {
          alert("خطا: " + (res.error ?? "unknown"));
          return;
        }
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("این سرور حذف شود؟")) return;
    try {
      const res = await nodesListApi.remove(id);
      if (!res.ok) {
        alert("خطا: " + (res.error ?? "unknown"));
        return;
      }
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  const toggleEnabled = async (n: NodeItem) => {
    try {
      await nodesListApi.update(n.id, { enabled: n.enabled ? false : true });
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  if (loading) return <div className="xray-loading">در حال بارگذاری…</div>;

  return (
    <div className="xray-app">
      <div className="xray-header">
        <div className="xray-header-left">
          <h2>مدیریت سرورها</h2>
          <span className="xray-server-badge">
            {nodes.length} سرور
          </span>
        </div>
        <button
          className="xray-create-btn"
          onClick={() =>
            setEditing({
              name: "",
              display_name: "",
              ip: "",
              port: 443,
              sni: "www.cloudflare.com",
              public_key: "",
              short_id: "",
              location: "",
            })
          }
        >
          + افزودن سرور
        </button>
      </div>

      {error && <div className="xray-error">{error}</div>}

      <div className="xray-users-list">
        {nodes.map((n) => (
          <div key={n.id} className={"xray-user-card " + (n.enabled ? "xray-user-active" : "xray-user-expired")}>
            <div className="xray-user-avatar" style={{ fontSize: 24 }}>
              🌐
            </div>

            <div className="xray-user-body">
              <div className="xray-user-header">
                <span className="xray-user-name">{n.display_name ?? n.name}</span>
                <span className={"xray-user-status-badge " + (n.enabled ? "xray-status-active" : "xray-status-expired")}>
                  {n.enabled ? "فعال" : "غیرفعال"}
                </span>
              </div>

              <div className="xray-user-uuid">{n.id}</div>

              <div className="xray-user-details" style={{ marginTop: 8 }}>
                <div className="xray-detail">
                  <span className="xray-detail-icon">📍</span>
                  <span>{n.location ?? "—"}</span>
                </div>
                <div className="xray-detail">
                  <span className="xray-detail-icon">🌐</span>
                  <span style={{ fontFamily: "monospace" }}>{n.ip}:{n.port}</span>
                </div>
                <div className="xray-detail">
                  <span className="xray-detail-icon">🔒</span>
                  <span>{n.sni}</span>
                </div>
              </div>
            </div>

            <div className="xray-user-actions-vertical">
              <button className="xray-action-btn xray-action-primary" onClick={() => setEditing(n)}>
                ویرایش
              </button>
              <button className="xray-action-btn xray-action-danger" onClick={() => toggleEnabled(n)}>
                {n.enabled ? "غیرفعال" : "فعال"}
              </button>
              <button className="xray-action-btn xray-action-danger" onClick={() => remove(n.id)}>
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="shop-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="shop-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? "ویرایش سرور" : "افزودن سرور جدید"}</h3>

            <div className="shop-form">
              <div className="shop-form-row">
                <label>
                  نام داخلی (id)
                  <input
                    type="text"
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="hetzner-nbg1-02"
                    disabled={!!editing.id}
                  />
                </label>
                <label>
                  نام نمایشی
                  <input
                    type="text"
                    value={editing.display_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                    placeholder="🇺🇸 USA"
                  />
                </label>
              </div>

              <div className="shop-form-row">
                <label>
                  IP
                  <input
                    type="text"
                    value={editing.ip ?? ""}
                    onChange={(e) => setEditing({ ...editing, ip: e.target.value })}
                    placeholder="1.2.3.4"
                  />
                </label>
                <label>
                  Port
                  <input
                    type="number"
                    value={editing.port ?? 443}
                    onChange={(e) => setEditing({ ...editing, port: parseInt(e.target.value) || 443 })}
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    value={editing.location ?? ""}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                    placeholder="Nuremberg, Germany"
                  />
                </label>
              </div>

              <label>
                SNI
                <input
                  type="text"
                  value={editing.sni ?? ""}
                  onChange={(e) => setEditing({ ...editing, sni: e.target.value })}
                  placeholder="www.cloudflare.com"
                />
              </label>

              <div className="shop-form-row">
                <label>
                  Public Key
                  <input
                    type="text"
                    value={editing.public_key ?? ""}
                    onChange={(e) => setEditing({ ...editing, public_key: e.target.value })}
                    placeholder="xray x25519 public key"
                  />
                </label>
                <label>
                  Short ID
                  <input
                    type="text"
                    value={editing.short_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, short_id: e.target.value })}
                    placeholder="8-byte hex"
                  />
                </label>
              </div>

              <div className="shop-form-hint">
                برای گرفتن PublicKey و ShortID: روی VPS بزن <code>xray x25519</code> و <code>openssl rand -hex 8</code>
              </div>
            </div>

            <div className="shop-modal-actions">
              <button className="shop-btn-cancel" onClick={() => setEditing(null)}>لغو</button>
              <button
                className="shop-btn-save"
                onClick={save}
                disabled={!editing.name?.trim() || !editing.ip?.trim()}
              >
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
