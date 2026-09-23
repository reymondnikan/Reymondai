// API client for Raymond backend

import type { Conversation, Message } from "../../shared/types";

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  default_model: string;
  description: string;
}

export const api = {
  health: () => req<{ ok: boolean; app: string; env: string; time: number }>("/system/health"),

  listProviders: () => req<ProviderInfo[]>("/system/providers"),

  listConversations: () => req<Conversation[]>("/chat/conversations"),

  createConversation: () =>
    req<Conversation>("/chat/conversations", { method: "POST" }),

  getMessages: (id: string) =>
    req<Message[]>(`/chat/conversations/${id}/messages`),

  sendMessage: (id: string, content: string, provider?: string, model?: string) =>
    req<{ ok: boolean }>(`/chat/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, provider, model }),
    }),

  deleteConversation: (id: string) =>
    req<{ ok: boolean }>(`/chat/conversations/${id}`, { method: "DELETE" }),
};
