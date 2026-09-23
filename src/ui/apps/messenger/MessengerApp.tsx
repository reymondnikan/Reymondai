import { useEffect, useState, useCallback } from "react";
import { messengerApi, type TgAccount, type TgChat, type TgMessage } from "./api";

export function MessengerApp() {
  const [accounts, setAccounts] = useState<TgAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [chats, setChats] = useState<TgChat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<TgMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [showAccounts, setShowAccounts] = useState(false);

  // Load accounts
  useEffect(() => {
    (async () => {
      try {
        const list = await messengerApi.listAccounts();
        setAccounts(list);
        if (list.length > 0) setActiveAccount(list[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load chats when account changes
  useEffect(() => {
    if (!activeAccount) return;
    (async () => {
      try {
        const list = await messengerApi.listChats(activeAccount);
        setChats(list);
        if (list.length > 0) setActiveChat(list[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [activeAccount]);

  // Load messages when chat changes
  useEffect(() => {
    if (!activeAccount || !activeChat) return;
    (async () => {
      try {
        const list = await messengerApi.listMessages(activeAccount, activeChat);
        setMessages(list);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [activeAccount, activeChat]);

  const send = useCallback(async () => {
    if (!activeAccount || !activeChat || !draft.trim()) return;
    const text = draft.trim();
    setDraft("");

    // Optimistic
    const temp: TgMessage = {
      id: "temp_" + Date.now(),
      chatId: activeChat,
      accountId: activeAccount,
      senderId: "me",
      senderName: "You",
      text,
      date: Date.now(),
      outgoing: true,
    };
    setMessages((p) => [...p, temp]);

    try {
      const real = await messengerApi.sendMessage(activeAccount, activeChat, text);
      setMessages((p) => p.map((m) => (m.id === temp.id ? real : m)));
    } catch (e) {
      console.error(e);
    }
  }, [activeAccount, activeChat, draft]);

  const activeChatObj = chats.find((c) => c.id === activeChat);
  const activeAccountObj = accounts.find((a) => a.id === activeAccount);

  return (
    <div className="messenger">
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
                  className={`messenger-account-item ${a.id === activeAccount ? "active" : ""}`}
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
                </div>
              ))}
              <div
                className="messenger-account-item add"
                onClick={() => {
                  setShowAccounts(false);
                  alert("Add account — coming soon (needs MTProto)");
                }}
              >
                <span className="messenger-account-avatar">+</span>
                <span style={{ color: "var(--accent)" }}>Add account</span>
              </div>
            </div>
          )}
        </div>

        <div className="messenger-chat-list">
          {chats.length === 0 && (
            <div className="messenger-empty">No chats</div>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`messenger-chat-item ${c.id === activeChat ? "active" : ""}`}
              onClick={() => setActiveChat(c.id)}
            >
              <div className="messenger-chat-avatar">
                {c.type === "channel" ? "📢" : c.type === "group" ? "👥" : c.type === "bot" ? "🤖" : "👤"}
              </div>
              <div className="messenger-chat-info">
                <div className="messenger-chat-title">
                  {c.pinned && <span style={{ color: "var(--accent)", fontSize: 10 }}>📌 </span>}
                  {c.title}
                </div>
                <div className="messenger-chat-preview">
                  {c.lastMessagePreview ?? "—"}
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
              <div className="messenger-chat-avatar" style={{ marginRight: 10 }}>
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
                  {activeChatObj.username ? ` · ${activeChatObj.username}` : ""}
                </div>
              </div>
            </div>

            <div className="messenger-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`messenger-msg ${m.outgoing ? "outgoing" : "incoming"}`}
                >
                  <div className="messenger-msg-text">{m.text}</div>
                  <div className="messenger-msg-time">{formatTime(m.date)}</div>
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
