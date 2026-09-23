// Ollama adapter — talk to a local Ollama server (for later, on your VPS).
//
// Setup (later): run Ollama somewhere, expose it via HTTPS, then:
//   wrangler secret put OLLAMA_URL     (e.g. https://ollama.yourdomain.com)
//   wrangler secret put OLLAMA_API_KEY (if you put a proxy in front)

import type { Env } from "../core/db";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OllamaInput {
  url: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}

export interface OllamaOutput {
  content: string;
  model: string;
}

export async function callOllama(input: OllamaInput): Promise<OllamaOutput> {
  const res = await fetch(`${input.url.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      stream: false,
      options: { temperature: input.temperature ?? 0.7 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    message?: { content?: string };
    model?: string;
  };

  const content = json.message?.content ?? "";
  if (!content) throw new Error("Empty response from Ollama");

  return { content, model: json.model ?? input.model };
}

export function getOllamaUrl(env: Env): string | null {
  const url = (env as unknown as { OLLAMA_URL?: string }).OLLAMA_URL;
  return url && url.length > 0 ? url : null;
}
