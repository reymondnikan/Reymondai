import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("editingUser &&")) {
  console.log("Modal already exists");
  process.exit(0);
}

// Find the closing of the main return — we'll insert modal before the last ");"
// Find the last "</div>\n  );\n}" pattern
const lastClose = c.lastIndexOf("</div>");
const endOfReturn = c.lastIndexOf("  );");

if (lastClose === -1 || endOfReturn === -1) {
  console.log("Could not find end of JSX");
  process.exit(1);
}

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

// Insert before "  );\n}" at the very end of file
const insertIdx = c.lastIndexOf("  );");
c = c.substring(0, insertIdx) + editModal + "\n" + c.substring(insertIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("OK - modal inserted");
