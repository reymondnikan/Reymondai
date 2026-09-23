// Telegram/Messenger API client.

export interface TgAccount {
  id: string;
  phone: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  status: string;
  createdAt: number;
  lastSeen?: number;
}

export interface TgChat {
  id: string;
  accountId: string;
  type: "user" | "group" | "channel" | "bot";
  title: string;
  username?: string;
  unreadCount: number;
  lastMessageAt: number;
  lastMessagePreview?: string;
  pinned: boolean;
  muted: boolean;
}

export interface TgMessage {
  id: string;
  chatId: string;
  accountId: string;
  senderId: string;
  senderName: string;
  text: string;
  date: number;
  outgoing: boolean;
}

const BASE = "/api/telegram";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export const messengerApi = {
  listAccounts: () => req<TgAccount[]>("/accounts"),
  listChats: (sessionId: string) =>
    req<TgChat[]>(`/chats?sessionId=${encodeURIComponent(sessionId)}`),
  listMessages: (sessionId: string, chatId: string) =>
    req<TgMessage[]>(
      `/messages?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`
    ),
  sendMessage: (sessionId: string, chatId: string, text: string) =>
    req<TgMessage>("/messages", {
      method: "POST",
      body: JSON.stringify({ sessionId, chatId, text }),
    }),
  deleteChat: (sessionId: string, chatId: string) =>
    req<{ ok: boolean }>(`/chats/${encodeURIComponent(chatId)}?sessionId=${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    }),
};
