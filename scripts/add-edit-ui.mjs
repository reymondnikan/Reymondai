import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// 1. Add editUser state
if (!c.includes("editingUser")) {
  c = c.replace(
    /const \[newMaxConn, setNewMaxConn\] = useState\(0\);/,
    `const [newMaxConn, setNewMaxConn] = useState(0);
  const [editingUser, setEditingUser] = useState<XrayUser | null>(null);
  const [editForm, setEditForm] = useState({
    quota_gb: 0,
    speed_mbps: 0,
    duration_days: 0,
    max_connections: 0,
    enabled: true,
  });
  const [editSaving, setEditSaving] = useState(false);`
  );
}

// 2. Add save function before `if (loading)`
if (!c.includes("const saveEdit = async")) {
  const beforeLoading = `if (loading) {`;
  const idx = c.indexOf(beforeLoading);
  
  if (idx !== -1) {
    const saveFn = `
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

`;
    c = c.substring(0, idx) + saveFn + c.substring(idx);
  }
}

// 3. Add edit button in user actions
if (!c.includes("onClick={() => openEdit(u)}")) {
  const showLinkBtn = `onClick={() => showLink(u)}`;
  const idx = c.indexOf(showLinkBtn);
  
  if (idx !== -1) {
    // Find the button that contains this onClick
    const btnStart = c.lastIndexOf("<button", idx);
    const btnEnd = c.indexOf("</button>", idx) + "</button>".length;
    
    if (btnStart !== -1 && btnEnd !== -1) {
      const originalBtn = c.substring(btnStart, btnEnd);
      const editBtn = `

                    <button
                      className="xray-action-btn xray-action-edit"
                      onClick={() => openEdit(u)}
                      title="ویرایش"
                    >
                      ویرایش
                    </button>`;
      c = c.substring(0, btnEnd) + editBtn + c.substring(btnEnd);
    }
  }
}

// 4. Add modal at the end (before closing </div>)
if (!c.includes("xray-edit-modal")) {
  // Find the link modal end
  const linkModalEnd = c.lastIndexOf("</div>\n    </div>\n  );\n}");
  
  if (linkModalEnd === -1) {
    console.log("WARN: could not find link modal end");
  } else {
    const editModal = `

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
`;
    c = c.substring(0, linkModalEnd) + editModal + c.substring(linkModalEnd);
  }
}

fs.writeFileSync(path, c, "utf-8");
console.log("XrayApp.tsx updated");
