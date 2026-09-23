import { useEffect, useState, useCallback } from "react";
import { authApi } from "./lib/auth-api";
import { api, setUnauthorizedHandler } from "./lib/api";
import { SetupScreen } from "./components/SetupScreen";
import { LoginScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { Dashboard } from "./components/Dashboard";
import type { Conversation, Message } from "../shared/types";
import type { ProviderInfo } from "./lib/api";

type View = "chat" | "dashboard" | "setup" | "login" | "loading";

export default function App() {
  const [view, setView] = useState<View>("loading");

  // Check auth status on mount
  useEffect(() => {
    (async () => {
      try {
        const status = await authApi.status();
        if (!status.initialized) {
          setView("setup");
          return;
        }
        try {
          await authApi.me();
          setView("chat");
        } catch {
          setView("login");
        }
      } catch {
        setView("login");
      }
    })();

    setUnauthorizedHandler(() => setView("login"));
  }, []);

  if (view === "loading") {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-logo">
            <span className="brand-dot" />
            <span>Raymond</span>
          </div>
          <div className="auth-subtitle">Loading...</div>
        </div>
      </div>
    );
  }

  if (view === "setup") {
    return <SetupScreen onComplete={() => setView("login")} />;
  }

  if (view === "login") {
    return <LoginScreen onComplete={() => setView("chat")} />;
  }

  return <MainApp onLogout={() => setView("login")} />;
}

function MainApp({ onLogout }: { onLogout: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("workers-ai");
  const [loading, setLoading] = useState(false);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [view, setView] = useState<"chat" | "dashboard">("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        const first = provs.find((p) => p.available);
        if (first) setSelectedProvider(first.id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      try {
        setMessages(await api.getMessages(activeId));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [activeId]);

  // Poll while loading
  useEffect(() => {
    if (!loading || !activeId) return;
    const iv = window.setInterval(async () => {
      try {
        const msgs = await api.getMessages(activeId);
        setMessages(msgs);
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant") {
          setLoading(false);
          window.clearInterval(iv);
        }
      } catch (e) {
        console.error(e);
      }
    }, 1200);
    return () => window.clearInterval(iv);
  }, [loading, activeId]);

  const newConversation = useCallback(async () => {
    try {
      const conv = await api.createConversation();
      setConversations((p) => [conv, ...p]);
      setActiveId(conv.id);
      setMessages([]);
      setView("chat");
      setSidebarOpen(false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        setConversations((p) => p.filter((c) => c.id !== id));
        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [activeId]
  );

  const send = useCallback(
    async (text: string) => {
      let convId = activeId;
      if (!convId) {
        const conv = await api.createConversation();
        setConversations((p) => [conv, ...p]);
        setActiveId(conv.id);
        convId = conv.id;
      }

      const temp: Message = {
        id: "temp_" + Date.now(),
        conversation_id: convId,
        role: "user",
        content: text,
        created_at: Date.now(),
      };
      setMessages((p) => [...p, temp]);
      setLoading(true);

      try {
        const info = providers.find((p) => p.id === selectedProvider);
        await api.sendMessage(convId, text, selectedProvider, info?.defaultModel);
        setConversations((p) =>
          p.map((c) =>
            c.id === convId && c.title === "New chat"
              ? { ...c, title: text.slice(0, 40) }
              : c
          )
        );
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    },
    [activeId, providers, selectedProvider]
  );

  const doLogout = async () => {
    try {
      await api.logout();
    } catch {}
    onLogout();
  };

  const activeConv = conversations.find((c) => c.id === activeId);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={(id) => {
          setActiveId(id);
          setView("chat");
          setSidebarOpen(false);
        }}
        onNew={newConversation}
        onDelete={deleteConversation}
        onOpenDashboard={() => {
          setView("dashboard");
          setSidebarOpen(false);
        }}
        onLogout={doLogout}
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
                      {p.name}
                      {p.available ? "" : " (off)"}
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
