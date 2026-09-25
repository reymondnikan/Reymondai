import fs from "node:fs";

const css = `

/* ===== Xray App — Full UI ===== */
.xray-app {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  overflow-y: auto;
  height: 100%;
}

.xray-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
  flex-wrap: wrap;
}

.xray-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.xray-header h2 {
  font-size: 22px;
  font-weight: 700;
}

.xray-server-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-family: "Courier New", monospace;
  color: var(--text-dim);
}

.xray-server-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 8px var(--ok);
}

.xray-sync-btn {
  background: transparent;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.xray-sync-btn:hover:not(:disabled) {
  background: var(--accent-soft);
}
.xray-sync-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats cards */
.xray-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.xray-stat-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}

.xray-stat-label {
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.xray-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.xray-stat-sub {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

/* Add user form */
.xray-section {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.xray-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

.xray-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.xray-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.xray-form-field label {
  font-size: 12px;
  color: var(--text-dim);
  font-weight: 500;
}

.xray-form-field input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  outline: none;
  color: var(--text);
  font-size: 14px;
  transition: border-color 0.15s;
}

.xray-form-field input:focus {
  border-color: var(--accent);
}

.xray-create-btn {
  background: var(--accent);
  color: white;
  padding: 11px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.xray-create-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.xray-create-btn:not(:disabled):hover {
  opacity: 0.9;
}

/* User cards */
.xray-users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.xray-user-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  transition: border-color 0.15s;
}

.xray-user-card:hover {
  border-color: var(--accent);
}

.xray-user-active {
  border-left: 3px solid var(--ok);
}

.xray-user-warn {
  border-left: 3px solid var(--warn);
}

.xray-user-full,
.xray-user-expired {
  border-left: 3px solid var(--danger);
  opacity: 0.7;
}

.xray-user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  flex-shrink: 0;
}

.xray-user-body {
  flex: 1;
  min-width: 0;
}

.xray-user-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.xray-user-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text);
}

.xray-user-status-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.xray-status-active {
  background: #38d39f22;
  color: var(--ok);
}
.xray-status-warn {
  background: #ffb84d22;
  color: var(--warn);
}
.xray-status-full,
.xray-status-expired {
  background: #ff4d6d22;
  color: var(--danger);
}

.xray-user-uuid {
  font-size: 11px;
  color: var(--text-dim);
  font-family: "Courier New", monospace;
  margin-bottom: 10px;
}

.xray-progress-row {
  margin-bottom: 10px;
}

.xray-progress-bar {
  height: 6px;
  background: var(--bg-elev);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 5px;
}

.xray-progress-fill {
  height: 100%;
  background: var(--ok);
  border-radius: 3px;
  transition: width 0.3s, background 0.3s;
}

.xray-progress-warn {
  background: var(--warn);
}
.xray-progress-full,
.xray-progress-expired {
  background: var(--danger);
}

.xray-progress-text {
  font-size: 12px;
  color: var(--text-dim);
}

.xray-user-details {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-dim);
}

.xray-detail {
  display: flex;
  align-items: center;
  gap: 4px;
}

.xray-detail-icon {
  font-size: 13px;
}

.xray-user-actions-vertical {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.xray-action-btn {
  padding: 7px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
  white-space: nowrap;
}

.xray-action-primary {
  background: var(--accent);
  color: white;
}

.xray-action-primary:hover {
  opacity: 0.9;
}

.xray-action-danger {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
}

.xray-action-danger:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.xray-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-dim);
  font-size: 14px;
}

.xray-loading {
  padding: 60px 20px;
  text-align: center;
  color: var(--text-dim);
}

.xray-error {
  background: #ff4d6d22;
  color: var(--danger);
  border: 1px solid #ff4d6d44;
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  margin-bottom: 16px;
}

/* Modal */
.xray-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.xray-modal {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  position: relative;
}

.xray-modal-header {
  margin-bottom: 24px;
}

.xray-modal-header h3 {
  font-size: 18px;
  color: var(--text);
  margin-bottom: 4px;
}

.xray-modal-username {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
  font-family: "Courier New", monospace;
}

.xray-modal-close {
  position: absolute;
  top: 16px;
  left: 16px;
  color: var(--text-dim);
  font-size: 18px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 6px;
}

.xray-modal-close:hover {
  background: var(--bg-elev);
  color: var(--text);
}

.xray-modal-section {
  margin-bottom: 20px;
}

.xray-modal-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--accent);
  margin-bottom: 10px;
}

.xray-modal-recommended {
  font-size: 10px;
  padding: 2px 8px;
  background: #38d39f22;
  color: var(--ok);
  border-radius: 4px;
  font-weight: 700;
}

.xray-modal-value {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-family: "Courier New", monospace;
  font-size: 12px;
  word-break: break-all;
  line-height: 1.6;
  margin-bottom: 12px;
  user-select: all;
  color: var(--text);
}

.xray-modal-value-small {
  font-size: 10px;
  max-height: 120px;
  overflow-y: auto;
}

.xray-modal-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.xray-modal-btn {
  flex: 1;
  padding: 11px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  transition: opacity 0.15s;
  border: none;
  display: inline-block;
}

.xray-modal-btn-primary {
  background: var(--accent);
  color: white;
}

.xray-modal-btn-secondary {
  background: transparent;
  border: 1px solid var(--accent);
  color: var(--accent);
}

.xray-modal-btn:hover {
  opacity: 0.9;
}

.xray-modal-hint {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.6;
}

.xray-modal-divider {
  height: 1px;
  background: var(--border);
  margin: 20px 0;
}

/* Mobile */
@media (max-width: 600px) {
  .xray-app {
    padding: 16px;
  }

  .xray-user-card {
    flex-direction: column;
    gap: 12px;
  }

  .xray-user-actions-vertical {
    flex-direction: row;
    width: 100%;
  }

  .xray-action-btn {
    flex: 1;
  }

  .xray-stats {
    grid-template-columns: 1fr 1fr;
  }
}
`;

fs.appendFileSync("src/ui/index.css", css, "utf-8");
console.log("OK", css.length);
