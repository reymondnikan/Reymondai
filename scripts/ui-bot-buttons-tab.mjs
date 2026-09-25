import fs from "node:fs";

const path = "src/ui/apps/shop/ShopApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// 1. Add import for BotButton
c = c.replace(
  /import \{[\s\S]*?\} from "\.\/api";/,
  `import {
  shopApi,
  formatToman,
  formatDate,
  type Product,
  type Order,
  type Stats,
  type BotButton,
} from "./api";`
);

// 2. Add "buttons" to Tab type
c = c.replace(
  /type Tab = "products" \| "orders" \| "settings";/,
  'type Tab = "products" | "orders" | "settings" | "buttons";'
);

// 3. Add tab button in the tabs row
if (!c.includes('setTab("buttons")')) {
  c = c.replace(
    /(<button\s+className=\{"shop-tab " \+ \(tab === "settings" \? "active" : ""\)\}\s+onClick=\{\(\) => setTab\("settings"\)\}\s*>\s*⚙️ تنظیمات\s*<\/button>)/,
    `$1
        <button
          className={"shop-tab " + (tab === "buttons" ? "active" : "")}
          onClick={() => setTab("buttons")}
        >
          🔘 دکمه‌های بات
        </button>`
  );
}

// 4. Add render for buttons tab
if (!c.includes("<ButtonsTab")) {
  c = c.replace(
    /(\{tab === "settings" && <SettingsTab onError=\{setError\} \/>\})/,
    '$1\n      {tab === "buttons" && <ButtonsTab onError={setError} />}'
  );
}

// 5. Add ButtonsTab component at the end (before final })
const buttonsTabComponent = `

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
`;

// Insert before the last "export function ShopApp"
const lastLine = c.lastIndexOf("export function ShopApp");
if (lastLine !== -1) {
  c = c.substring(0, lastLine) + buttonsTabComponent + "\n\n" + c.substring(lastLine);
}

fs.writeFileSync(path, c, "utf-8");
console.log("ShopApp.tsx updated");
