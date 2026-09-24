import { useEffect, useState, useCallback } from "react";
import { tgManager, type TgSessionInfo } from "../../lib/telegram/client";
import { TgLoginScreen } from "./TgLoginScreen";
import {
  loadRealChats,
  loadRealMessages,
  sendRealMessage,
  type TgChatReal,
  type TgMessageReal,
} from "./real-chats";

export function MessengerApp() {
  const [accounts, setAccounts] = useState<TgSessionInfo[]>([]);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [chats, setChats] = useState<TgChatReal[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<TgMessageReal[]>([]);
  const [draft, setDraft] = useState("");
  const [showAccounts, setShowAccounts] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Restore sessions on mount
  useEffect(() => {
    (async () => {
      try {
        const restored = await tgManager.restoreAll();
        setAccounts(restored);
        if (restored.length > 0) setActiveAccount(restored[0].id);
        else setShowLogin(true);
      } catch (e) {
        console.error("restoreAll failed:", e);
        setShowLogin(true);
      }
    })();
  }, []);

  // Load chats when account changes
  useEffect(() => {
    if (!activeAccount) return;
    setLoadingChats(true);
    setChats([]);
    setActiveChat(null);
    setMessages([]);
    (async () => {
      try {
        const list = await loadRealChats(activeAccount);
        setChats(list);
        if (list.length > 0) setActiveChat(list[0].id);
      } catch (e) {
        console.error("loadRealChats failed:", e);
      } finally {
        setLoadingChats(false);
      }
    })();
  }, [activeAccount]);

  // Load messages when chat changes
  useEffect(() => {
    if (!activeAccount || !activeChat) return;
    setLoadingMessages(true);
    (async () => {
      try {
        const list = await loadRealMessages(activeAccount, activeChat);
        setMessages(list);
      } catch (e) {
        console.error("loadRealMessages failed:", e);
      } finally {
        setLoadingMessages(false);
      }
    })();
  }, [activeAccount, activeChat]);

  const send = useCallback(async () => {
    if (!activeAccount || !activeChat || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");

    // Optimistic
    const temp: TgMessageReal = {
      id: "temp_" + Date.now(),
      text,
      date: Date.now(),
      outgoing: true,
      senderName: "You",
    };
    setMessages((p) => [...p, temp]);

    try {
      await sendRealMessage(activeAccount, activeChat, text);
      // Reload messages to get the real one
      const refreshed = await loadRealMessages(activeAccount, activeChat);
      setMessages(refreshed);
    } catch (e) {
      console.error("sendRealMessage failed:", e);
    }
  }, [activeAccount, activeChat, draft]);

  const handleLoginComplete = (info: TgSessionInfo) => {
    setAccounts((p) => [...p, info]);
    setActiveAccount(info.id);
    setShowLogin(false);
  };

  const logoutAccount = async (id: string) => {
    await tgManager.logout(id);
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (activeAccount === id) {
      setActiveAccount(remaining[0]?.id ?? null);
      setChats([]);
      setMessages([]);
    }
    setShowAccounts(false);
  };

  if (showLogin) {
    return (
      <TgLoginScreen
        onComplete={handleLoginComplete}
        onCancel={() => setShowLogin(false)}
      />
    );
  }

  const activeChatObj = chats.find((c) => c.id === activeChat);
  const activeAccountObj = accounts.find((a) => a.id === activeAccount);

  return (
    <div className={`messenger ${activeChat ? "has-active-chat" : ""}`}>
      {/* Chats column */}
      <div className="messenger-chats">
        <div className="messenger-chats-header">
          <button
            className="messenger-account-btn"
            onClick={() => setShowAccounts((v) => !v)}
            title="Switch account"
          >
            <span className="messenger-account-avatar">
              {(activeAccountObj?.firstName?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="messenger-account-name">
              {activeAccountObj?.firstName ?? "No account"}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>▼</span>
          </button>

          {showAccounts && (
            <div className="messenger-accounts-dropdown">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className={`messenger-account-item ${
                    a.id === activeAccount ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveAccount(a.id);
                    setShowAccounts(false);
                  }}
                >
                  <span className="messenger-account-avatar">
                    {(a.firstName?.[0] ?? "?").toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="messenger-account-name">
                      {a.firstName ?? a.username ?? a.phone}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                      {a.phone}
                    </div>
                  </div>
                  <button
                    className="conv-delete"
                    style={{ opacity: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      logoutAccount(a.id);
                    }}
                    title="Logout"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div
                className="messenger-account-item add"
                onClick={() => {
                  setShowAccounts(false);
                  setShowLogin(true);
                }}
              >
                <span className="messenger-account-avatar">+</span>
                <span style={{ color: "var(--accent)" }}>Add account</span>
              </div>
            </div>
          )}
        </div>

        <div className="messenger-chat-list">
          {loadingChats && (
            <div className="messenger-empty">Loading chats…</div>
          )}
          {!loadingChats && chats.length === 0 && (
            <div className="messenger-empty">No chats</div>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`messenger-chat-item ${
                c.id === activeChat ? "active" : ""
              }`}
              onClick={() => setActiveChat(c.id)}
            >
              <div className="messenger-chat-avatar">
                {c.type === "channel"
                  ? "📢"
                  : c.type === "group"
                  ? "👥"
                  : c.type === "bot"
                  ? "🤖"
                  : "👤"}
              </div>
              <div className="messenger-chat-info">
                <div className="messenger-chat-title">
                  {c.pinned && (
                    <span style={{ color: "var(--accent)", fontSize: 10 }}>
                      📌{" "}
                    </span>
                  )}
                  {c.title}
                </div>
                <div className="messenger-chat-preview">
                  {c.lastMessagePreview || "—"}
                </div>
              </div>
              <div className="messenger-chat-meta">
                <div className="messenger-chat-time">
                  {formatTime(c.lastMessageAt)}
                </div>
                {c.unreadCount > 0 && (
                  <div className="messenger-chat-badge">{c.unreadCount}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages column */}
      <div className="messenger-view">
        {activeChatObj ? (
          <>
            <div className="messenger-view-header">
              <button
                className="menu-btn"
                style={{ marginRight: 8 }}
                onClick={() => setActiveChat(null)}
                title="Back"
              >
                ←
              </button>
              <div
                className="messenger-chat-avatar"
                style={{ marginRight: 10 }}
              >
                {activeChatObj.type === "channel"
                  ? "📢"
                  : activeChatObj.type === "group"
                  ? "👥"
                  : activeChatObj.type === "bot"
                  ? "🤖"
                  : "👤"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{activeChatObj.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {activeChatObj.type}
                </div>
              </div>
            </div>

            <div className="messenger-messages">
              {loadingMessages && (
                <div className="messenger-empty">Loading messages…</div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div className="messenger-empty">No messages yet</div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`messenger-msg ${
                    m.outgoing ? "outgoing" : "incoming"
                  }`}
                >
                  <div className="messenger-msg-text">{m.text}</div>
                  <div className="messenger-msg-time">
                    {formatTime(m.date)}
                  </div>
                </div>
              ))}
            </div>

            <div className="messenger-composer">
              <input
                type="text"
                placeholder="Message..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button onClick={send} disabled={!draft.trim()}>
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="messenger-empty-large">
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div>Select a chat</div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
