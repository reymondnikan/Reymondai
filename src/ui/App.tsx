import { useEffect, useRef, useState, useCallback } from "react";
import { api, type ProviderInfo } from "./lib/api";
import { Sidebar } from "./components/Sidebar";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { Dashboard } from "./components/Dashboard";
import type { Conversation, Message } from "../shared/types";

type View = "chat" | "dashboard";

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("workers-ai");
  const [loading, setLoading] = useState(false);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pollRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        await api.health();
        setHealthy(true);
      } catch {
        setHealthy(false);
      }
      try {
        const [convs, provs] = await Promise.all([
          api.listConversations(),
          api.listProviders(),
        ]);
        setConversations(convs);
        setProviders(provs);
        const firstAvailable = provs.find((p) => p.available);
        if (firstAvailable) setSelectedProvider(firstAvailable.id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load messages when active changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      try {
        const msgs = await api.getMessages(activeId);
        setMessages(msgs);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [activeId]);

  // Poll for new messages while loading
  useEffect(() => {
    if (!loading || !activeId) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const msgs = await api.getMessages(activeId);
        setMessages(msgs);
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          setLoading(false);
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      } catch (e) {
        console.error(e);
      }
    }, 1200);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [loading, activeId]);

  const newConversation = useCallback(async () => {
    try {
      const conv = await api.createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      setMessages([]);
      setView("chat");
      setSidebarOpen(false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeId]);

  const send = useCallback(async (text: string) => {
    let convId = activeId;
    if (!convId) {
      const conv = await api.createConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
      convId = conv.id;
    }

    // Optimistic user message
    const temp: Message = {
      id: "temp_" + Date.now(),
      conversation_id: convId,
      role: "user",
      content: text,
      created_at: Date.now(),
    };
    setMessages((prev) => [...prev, temp]);
    setLoading(true);

    try {
      const info = providers.find((p) => p.id === selectedProvider);
      await api.sendMessage(convId, text, selectedProvider, info?.default_model);
      // Refresh conversation title in sidebar (first user message becomes title)
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId && c.title === "New chat"
            ? { ...c, title: text.slice(0, 40) }
            : c
        )
      );
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [activeId, providers, selectedProvider]);

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => { setActiveId(id); setView("chat"); setSidebarOpen(false); }}
        onNew={newConversation}
        onDelete={deleteConversation}
        onOpenDashboard={() => { setView("dashboard"); setSidebarOpen(false); }}
        healthy={healthy}
      />

      <main className="chat">
        {view === "dashboard" ? (
          <Dashboard onBack={() => setView("chat")} />
        ) : (
          <>
            <header className="chat-header">
              <button
                className="menu-btn"
                onClick={() => setSidebarOpen(true)}
                title="Menu"
              >
                ☰
              </button>
              <div className="chat-title">
                {activeConv?.title ?? "New chat"}
              </div>
              <div className="provider-picker">
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.available}>
                      {p.name}{p.available ? "" : " (off)"}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            <MessageList messages={messages} loading={loading} />

            <Composer onSend={send} disabled={loading} />
          </>
        )}
      </main>
    </div>
  );
}
