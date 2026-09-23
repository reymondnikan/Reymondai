import { useEffect, useRef } from "react";
import type { Message } from "../../shared/types";

interface Props {
  messages: Message[];
  loading: boolean;
}

export function MessageList({ messages, loading }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="messages">
        <div className="welcome">
          <h1>Raymond</h1>
          <p>
            Your personal AI control plane. Ask a question, or just start typing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.role}`}>
          <div className="msg-avatar">{m.role === "user" ? "U" : "R"}</div>
          <div className="msg-body">
            <div className="msg-role">{m.role === "user" ? "You" : "Raymond"}</div>
            <div className="msg-content">{m.content}</div>
            {m.role === "assistant" && (m.provider || m.latency_ms) && (
              <div className="msg-meta">
                {m.provider && <span>{m.provider}</span>}
                {m.model && <span> · {m.model}</span>}
                {m.latency_ms ? <span> · {m.latency_ms}ms</span> : null}
              </div>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div className="msg assistant">
          <div className="msg-avatar">R</div>
          <div className="msg-body">
            <div className="msg-role">Raymond</div>
            <div className="typing">
              <span /><span /><span />
            </div>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
