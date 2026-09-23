import type { Conversation } from "../../shared/types";

interface AppInfo {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
  healthy: boolean | null;
  currentTab: string;
  apps: AppInfo[];
  onSelectTab: (id: string) => void;
}

export function Sidebar(p: Props) {
  return (
    <>
      {p.open && <div className="sidebar-backdrop" onClick={p.onClose} />}
      <aside className={`sidebar ${p.open ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-dot" />
            <span>Raymond</span>
          </div>
          <button
            onClick={p.onLogout}
            title="Logout"
            style={{ color: "var(--text-dim)", fontSize: 16 }}
          >
            ⎋
          </button>
        </div>

        {/* Tab navigation */}
        <div className="tab-nav">
          <div
            className={`tab-item ${p.currentTab === "chat" ? "active" : ""}`}
            onClick={() => p.onSelectTab("chat")}
          >
            <span className="tab-icon">💭</span>
            <span className="tab-label">Chat</span>
          </div>

          {p.apps.map((app) => (
            <div
              key={app.id}
              className={`tab-item ${p.currentTab === app.id ? "active" : ""}`}
              onClick={() => p.onSelectTab(app.id)}
            >
              <span className="tab-icon">{app.icon}</span>
              <span className="tab-label">{app.name}</span>
            </div>
          ))}

          <div
            className={`tab-item ${p.currentTab === "dashboard" ? "active" : ""}`}
            onClick={p.onOpenDashboard}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Dashboard</span>
          </div>
        </div>

        {p.currentTab === "chat" && (
          <>
            <button className="new-chat-btn" onClick={p.onNew}>
              + New chat
            </button>

            <div className="conv-list">
              {p.conversations.length === 0 && (
                <div
                  style={{
                    padding: 16,
                    color: "var(--text-dim)",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  No conversations yet
                </div>
              )}
              {p.conversations.map((c) => (
                <div
                  key={c.id}
                  className={`conv-item ${
                    c.id === p.activeId ? "active" : ""
                  }`}
                  onClick={() => p.onSelect(c.id)}
                >
                  <span className="conv-title">{c.title || "New chat"}</span>
                  <button
                    className="conv-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onDelete(c.id);
                    }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {p.currentTab !== "chat" && <div style={{ flex: 1 }} />}

        <div className="sidebar-footer">
          <span>
            <span
              className={`status-dot ${p.healthy ? "online" : "offline"}`}
            />
            {p.healthy ? "Online" : p.healthy === false ? "Offline" : "..."}
          </span>
          <span>v0.2</span>
        </div>
      </aside>
    </>
  );
}
