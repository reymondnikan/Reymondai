import { useState, useEffect, useCallback } from "react";
import {
  shopApi,
  formatToman,
  formatDate,
  type Product,
  type Order,
  type Stats,
  type BotButton,
} from "./api";

type Tab = "products" | "orders" | "settings" | "buttons";



// ============================================================
// Buttons Tab
// ============================================================
function ButtonsTab({ onError }: { onError: (e: string | null) => void }) {
  const [buttons, setButtons] = useState<BotButton[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<BotButton> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getBotButtons();
      if (res.ok) setButtons(res.buttons);
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    if (!editing.label?.trim()) {
      alert("متن دکمه اجباریه");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: editing.label,
        action_type: editing.action_type ?? "text",
        action_value: editing.action_value ?? "",
        visible_to: editing.visible_to ?? "all",
        sort_order: editing.sort_order ?? 100,
        enabled: editing.enabled ?? true,
      };
      if (editing.id) {
        await shopApi.updateBotButton(editing.id, payload);
      } else {
        await shopApi.createBotButton(payload);
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف این دکمه؟")) return;
    try {
      await shopApi.deleteBotButton(id);
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  const toggle = async (b: BotButton) => {
    try {
      await shopApi.updateBotButton(b.id, { enabled: !b.enabled });
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  if (loading) return <div className="shop-loading">در حال بارگذاری…</div>;

  return (
    <div className="shop-section">
      <div className="shop-section-header">
        <h3>دکمه‌های سفارشی بات ({buttons.length})</h3>
        <button
          className="shop-btn-add"
          onClick={() =>
            setEditing({
              label: "",
              action_type: "text",
              action_value: "",
              visible_to: "all",
              sort_order: 100,
              enabled: true,
            })
          }
        >
          + افزودن دکمه
        </button>
      </div>

      {buttons.length === 0 && (
        <div className="shop-empty">
          هنوز دکمه سفارشی نساختی. یه دکمه اضافه کن (مثلاً راهنما یا کانال).
        </div>
      )}

      <div className="shop-products-list">
        {buttons.map((b) => (
          <div key={b.id} className={"shop-product-card " + (b.enabled ? "" : "disabled")}>
            <div className="shop-product-header">
              <span className="shop-product-name">{b.label}</span>
              <span className={"shop-product-status " + (b.enabled ? "on" : "off")}>
                {b.enabled ? "فعال" : "غیرفعال"}
              </span>
            </div>

            <div className="shop-product-specs">
              <span>
                {b.action_type === "text" && "📝 پیام"}
                {b.action_type === "url" && "🔗 لینک"}
                {b.action_type === "callback" && "⚡ اقدام"}
              </span>
              <span>
                {b.visible_to === "all" && "👥 همه"}
                {b.visible_to === "admins" && "🛡 ادمین"}
                {b.visible_to === "users" && "👤 کاربران"}
              </span>
            </div>

            {b.action_value && (
              <div className="shop-product-desc" style={{ wordBreak: "break-all", fontSize: 11, fontFamily: "monospace" }}>
                {b.action_value}
              </div>
            )}

            <div className="shop-product-actions">
              <button className="shop-btn-edit" onClick={() => setEditing(b)}>
                ✏️ ویرایش
              </button>
              <button className="shop-btn-toggle" onClick={() => toggle(b)}>
                {b.enabled ? "🔒 غیرفعال" : "🔓 فعال"}
              </button>
              <button className="shop-btn-delete" onClick={() => remove(b.id)}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="shop-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="shop-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? "ویرایش دکمه" : "دکمه جدید"}</h3>

            <div className="shop-form">
              <label>
                متن دکمه (می‌تونی ایموجی بذاری)
                <input
                  type="text"
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="📖 راهنما"
                />
              </label>

              <label>
                نوع اقدام
                <select
                  value={editing.action_type ?? "text"}
                  onChange={(e) => setEditing({ ...editing, action_type: e.target.value as BotButton["action_type"] })}
                >
                  <option value="text">نمایش پیام متنی</option>
                  <option value="url">باز کردن لینک</option>
                  <option value="callback">اقدام (به زودی)</option>
                </select>
              </label>

              <label>
                مقدار (متن یا URL)
                <textarea
                  value={editing.action_value ?? ""}
                  onChange={(e) => setEditing({ ...editing, action_value: e.target.value })}
                  placeholder={editing.action_type === "url" ? "https://t.me/channel" : "متن پیامی که نمایش داده می‌شه"}
                  rows={4}
                  style={{
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                    fontSize: 14,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </label>

              <label>
                نمایش به
                <select
                  value={editing.visible_to ?? "all"}
                  onChange={(e) => setEditing({ ...editing, visible_to: e.target.value as BotButton["visible_to"] })}
                >
                  <option value="all">همه</option>
                  <option value="users">فقط کاربران</option>
                  <option value="admins">فقط ادمین</option>
                </select>
              </label>

              <label>
                ترتیب نمایش
                <input
                  type="number"
                  value={editing.sort_order ?? 100}
                  onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 100 })}
                  min={0}
                />
              </label>

              <label style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={editing.enabled ?? true}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                  style={{ width: 18, height: 18 }}
                />
                <span>فعال</span>
              </label>
            </div>

            <div className="shop-modal-actions">
              <button className="shop-btn-cancel" onClick={() => setEditing(null)}>
                لغو
              </button>
              <button className="shop-btn-save" onClick={save} disabled={saving}>
                {saving ? "…" : "ذخیره"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export function ShopApp() {
  const [tab, setTab] = useState<Tab>("orders");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await shopApi.getStats();
      setStats({
        total: s.total,
        pending: s.pending,
        completed: s.completed,
        rejected: s.rejected,
        revenue: s.revenue,
        revenueToday: s.revenueToday,
      });
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const iv = window.setInterval(loadStats, 30000);
    return () => window.clearInterval(iv);
  }, [loadStats]);

  return (
    <div className="shop-app">
      {/* Stats cards */}
      <div className="shop-stats">
        <StatCard
          label="در انتظار تایید"
          value={stats?.pending ?? 0}
          color="warn"
          onClick={() => setTab("orders")}
        />
        <StatCard
          label="تایید شده"
          value={stats?.completed ?? 0}
          color="ok"
          onClick={() => setTab("orders")}
        />
        <StatCard
          label="کل سفارشها"
          value={stats?.total ?? 0}
          color="accent"
        />
        <StatCard
          label="درآمد امروز"
          value={formatToman(stats?.revenueToday ?? 0)}
          color="ok"
          small
        />
      </div>

      {/* Tabs */}
      <div className="shop-tabs">
        <button
          className={"shop-tab " + (tab === "orders" ? "active" : "")}
          onClick={() => setTab("orders")}
        >
          🛒 سفارشها
        </button>
        <button
          className={"shop-tab " + (tab === "products" ? "active" : "")}
          onClick={() => setTab("products")}
        >
          📦 پلنها
        </button>
        <button
          className={"shop-tab " + (tab === "settings" ? "active" : "")}
          onClick={() => setTab("settings")}
        >
          ⚙️ تنظیمات
        </button>
        <button
          className={"shop-tab " + (tab === "buttons" ? "active" : "")}
          onClick={() => setTab("buttons")}
        >
          🔘 دکمه‌های بات
        </button>
      </div>

      {error && <div className="shop-error">{error}</div>}

      {tab === "orders" && <OrdersTab onStatsChange={loadStats} onError={setError} />}
      {tab === "products" && <ProductsTab onError={setError} />}
      {tab === "settings" && <SettingsTab onError={setError} />}
      {tab === "buttons" && <ButtonsTab onError={setError} />}
    </div>
  );
}

// ============================================================
// Stat card
// ============================================================
function StatCard({
  label,
  value,
  color,
  onClick,
  small,
}: {
  label: string;
  value: number | string;
  color: "accent" | "ok" | "warn" | "danger";
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <div
      className={"shop-stat-card shop-stat-" + color}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="shop-stat-label">{label}</div>
      <div className={"shop-stat-value " + (small ? "small" : "")}>{value}</div>
    </div>
  );
}

// ============================================================
// Orders Tab
// ============================================================
function OrdersTab({
  onStatsChange,
  onError,
}: {
  onStatsChange: () => void;
  onError: (e: string | null) => void;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("pending_approval");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getOrders(filter || undefined);
      if (res.ok) setOrders(res.orders);
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id: string) => {
    if (!confirm("تایید این سفارش و ساخت اکانت")) return;
    setBusy(id);
    try {
      const res = await shopApi.approveOrder(id);
      if (!res.ok) {
        alert("خطا: " + (res.error ?? "unknown"));
      }
      await load();
      onStatsChange();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reject = async (id: string) => {
    const reason = prompt("دلیل رد (اختیاری):");
    if (reason === null) return;
    setBusy(id);
    try {
      await shopApi.rejectOrder(id, reason || undefined);
      await load();
      onStatsChange();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف این سفارش")) return;
    try {
      await shopApi.deleteOrder(id);
      await load();
      onStatsChange();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  const filters = [
    { key: "pending_approval", label: "⏳ در انتظار" },
    { key: "completed", label: "✅ تایید شده" },
    { key: "rejected", label: "❌ رد شده" },
    { key: "", label: "همه" },
  ];

  return (
    <div className="shop-section">
      <div className="shop-filter-row">
        {filters.map((f) => (
          <button
            key={f.key}
            className={"shop-filter-btn " + (filter === f.key ? "active" : "")}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <button className="shop-refresh-btn" onClick={load}>
          🔄
        </button>
      </div>

      {loading && <div className="shop-loading">در حال بارگذاری…</div>}

      {!loading && orders.length === 0 && (
        <div className="shop-empty">سفارشی نیست</div>
      )}

      <div className="shop-orders-list">
        {orders.map((o) => (
          <div key={o.id} className={"shop-order-card shop-order-" + o.status}>
            <div className="shop-order-header">
              <span className="shop-order-product">{o.product_name}</span>
              <span className={"shop-order-badge shop-badge-" + o.status}>
                {o.status === "pending_approval" && "در انتظار"}
                {o.status === "completed" && "تایید شده"}
                {o.status === "rejected" && "رد شده"}
              </span>
            </div>

            <div className="shop-order-body">
              <div className="shop-order-user">
                👤 {o.user_first_name ?? "—"}
                {o.user_username && <span className="shop-order-username">@{o.user_username}</span>}
                <span className="shop-order-id">ID: {o.user_telegram_id}</span>
              </div>

              <div className="shop-order-price">{formatToman(o.price_toman)}</div>

              <div className="shop-order-date">📅 {formatDate(o.created_at)}</div>

              {o.xray_user_name && (
                <div className="shop-order-xray">
                  🔑 <code>{o.xray_user_name}</code>
                </div>
              )}
            </div>

            <div className="shop-order-actions">
              {o.status === "pending_approval" && (
                <>
                  <button
                    className="shop-btn-approve"
                    onClick={() => approve(o.id)}
                    disabled={busy === o.id}
                  >
                    {busy === o.id ? "…" : "✅ تایید و ساخت"}
                  </button>
                  <button
                    className="shop-btn-reject"
                    onClick={() => reject(o.id)}
                    disabled={busy === o.id}
                  >
                    ❌ رد
                  </button>
                </>
              )}
              {o.status === "completed" && o.xray_sub_token && (
                <button
                  className="shop-btn-link"
                  onClick={() => {
                    const url = window.location.origin + "/api/xray/sub/" + o.xray_sub_token;
                    navigator.clipboard.writeText(url);
                    alert("لینک کپی شد");
                  }}
                >
                  📋 کپی لینک
                </button>
              )}
              <button
                className="shop-btn-delete"
                onClick={() => remove(o.id)}
                title="حذف"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Products Tab
// ============================================================
function ProductsTab({ onError }: { onError: (e: string | null) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shopApi.getProducts();
      if (res.ok) setProducts(res.products);
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await shopApi.updateProduct(editing.id, editing);
      } else {
        await shopApi.createProduct(editing);
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف این پلن")) return;
    try {
      await shopApi.deleteProduct(id);
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  const toggleEnabled = async (p: Product) => {
    try {
      await shopApi.updateProduct(p.id, { enabled: p.enabled ? false : true });
      await load();
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    }
  };

  if (loading) return <div className="shop-loading">در حال بارگذاری…</div>;

  return (
    <div className="shop-section">
      <div className="shop-section-header">
        <h3>پلنهای فروش ({products.length})</h3>
        <button
          className="shop-btn-add"
          onClick={() =>
            setEditing({
              name: "",
              description: "",
              quota_gb: 30,
              speed_mbps: 100,
              duration_days: 30,
              price_toman: 100000,
              enabled: true,
            })
          }
        >
          + افزودن پلن
        </button>
      </div>

      <div className="shop-products-list">
        {products.map((p) => (
          <div
            key={p.id}
            className={"shop-product-card " + (p.enabled ? "" : "disabled")}
          >
            <div className="shop-product-header">
              <span className="shop-product-name">{p.name}</span>
              <span className={"shop-product-status " + (p.enabled ? "on" : "off")}>
                {p.enabled ? "فعال" : "غیرفعال"}
              </span>
            </div>

            <div className="shop-product-specs">
              <span>📊 {p.quota_gb} GB</span>
              <span>⚡ {p.speed_mbps > 0 ? p.speed_mbps + " Mbps" : "بینهایت"}</span>
              <span>📅 {p.duration_days} روز</span>
            </div>

            <div className="shop-product-price">{formatToman(p.price_toman)}</div>

            {p.description && (
              <div className="shop-product-desc">{p.description}</div>
            )}

            <div className="shop-product-actions">
              <button className="shop-btn-edit" onClick={() => setEditing(p)}>
                ✏️ ویرایش
              </button>
              <button className="shop-btn-toggle" onClick={() => toggleEnabled(p)}>
                {p.enabled ? "🔒 غیرفعال" : "🔓 فعال"}
              </button>
              <button className="shop-btn-delete" onClick={() => remove(p.id)}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="shop-modal-backdrop" onClick={() => setEditing(null)}>
          <div className="shop-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? "ویرایش پلن" : "پلن جدید"}</h3>

            <div className="shop-form">
              <label>
                نام پلن
                <input
                  type="text"
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="مثلاً برنزی"
                />
              </label>

              <label>
                توضیحات (اختیاری)
                <input
                  type="text"
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="مناسب استفاده روزمره"
                />
              </label>

              <div className="shop-form-row">
                <label>
                  حجم (GB)
                  <input
                    type="number"
                    value={editing.quota_gb ?? 0}
                    onChange={(e) => setEditing({ ...editing, quota_gb: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </label>
                <label>
                  سرعت (Mbps)
                  <input
                    type="number"
                    value={editing.speed_mbps ?? 0}
                    onChange={(e) => setEditing({ ...editing, speed_mbps: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </label>
                <label>
                  مدت (روز)
                  <input
                    type="number"
                    value={editing.duration_days ?? 0}
                    onChange={(e) => setEditing({ ...editing, duration_days: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                </label>
              </div>

              <label>
                قیمت (تومان)
                <input
                  type="number"
                  value={editing.price_toman ?? 0}
                  onChange={(e) => setEditing({ ...editing, price_toman: parseInt(e.target.value) || 0 })}
                  min={0}
                  step={1000}
                />
              </label>

              <div className="shop-form-hint">
                ۰ = بینهایت (برای حجم سرعت یا مدت)
              </div>
            </div>

            <div className="shop-modal-actions">
              <button className="shop-btn-cancel" onClick={() => setEditing(null)}>
                لغو
              </button>
              <button
                className="shop-btn-save"
                onClick={save}
                disabled={!editing.name?.trim()}
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

// ============================================================
// Settings Tab
// ============================================================
function SettingsTab({ onError }: { onError: (e: string | null) => void }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await shopApi.getSettings();
        if (res.ok) setSettings(res.settings as Record<string, string>);
        onError(null);
      } catch (e) {
        onError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [onError]);

  const save = async () => {
    setSaving(true);
    try {
      for (const [k, v] of Object.entries(settings)) {
        await shopApi.setSetting(k, v);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert("خطا: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="shop-loading">در حال بارگذاری…</div>;

  const fields: Array<{ key: string; label: string; placeholder?: string }> = [
    { key: "shop_name", label: "نام فروشگاه", placeholder: "Raymond VPN" },
    { key: "shop_description", label: "توضیح فروشگاه", placeholder: "پروکسی پرسرعت و پایدار" },
    { key: "support_username", label: "یوزرنیم پشتیبانی", placeholder: "@support" },
    { key: "payment_card", label: "شماره کارت", placeholder: "6037-XXXX-XXXX-XXXX" },
    { key: "payment_holder", label: "نام صاحب کارت", placeholder: "نام و نام خانوادگی" },
    { key: "welcome_message", label: "پیام خوشآمد (برای بات)", placeholder: "به فروشگاه ما خوش آمدید" },
  ];

  return (
    <div className="shop-section">
      <div className="shop-section-header">
        <h3>تنظیمات فروشگاه</h3>
      </div>

      <div className="shop-form">
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type="text"
              value={settings[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) =>
                setSettings({ ...settings, [f.key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>

      <div className="shop-settings-actions">
        <button className="shop-btn-save" onClick={save} disabled={saving}>
          {saving ? "در حال ذخیره…" : saved ? "✓ ذخیره شد" : "ذخیره تنظیمات"}
        </button>
      </div>

      <div className="shop-settings-hint">
        این تنظیمات مستقیماً توی بات تلگرام نشون داده میشن.
      </div>
    </div>
  );
}
