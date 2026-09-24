// Telegram chat loader — pulls real chats/messages via GramJS.

import { tgManager } from "../../lib/telegram/client";

export interface TgChatReal {
  id: string;
  title: string;
  type: "user" | "group" | "channel" | "bot";
  unreadCount: number;
  lastMessageAt: number;
  lastMessagePreview: string;
  pinned: boolean;
}

export interface TgMessageReal {
  id: string;
  text: string;
  date: number;
  outgoing: boolean;
  senderName: string;
}

export async function loadRealChats(sessionId: string): Promise<TgChatReal[]> {
  const client = (tgManager as unknown as {
    clients: Map<string, unknown>;
  }).clients.get(sessionId);
  if (!client) throw new Error("Session not connected");

  const c = client as {
    getDialogs: (opts: { limit: number }) => Promise<unknown[]>;
  };

  const dialogs = await c.getDialogs({ limit: 50 });

  const chats: TgChatReal[] = [];
  for (const d of dialogs) {
    const dlg = d as {
      id?: { toString: () => string };
      title?: string;
      name?: string;
      unreadCount?: number;
      date?: number;
      message?: { message?: string };
      isUser?: boolean;
      isGroup?: boolean;
      isChannel?: boolean;
      entity?: { bot?: boolean };
      pinned?: boolean;
    };

    let type: TgChatReal["type"] = "user";
    if (dlg.isGroup) type = "group";
    else if (dlg.isChannel) type = "channel";
    else if (dlg.entity?.bot) type = "bot";

    chats.push({
      id: dlg.id?.toString() ?? "",
      title: dlg.title ?? dlg.name ?? "(unnamed)",
      type,
      unreadCount: dlg.unreadCount ?? 0,
      lastMessageAt: (dlg.date ?? 0) * 1000,
      lastMessagePreview: dlg.message?.message ?? "",
      pinned: !!dlg.pinned,
    });
  }

  return chats;
}

export async function loadRealMessages(
  sessionId: string,
  chatId: string
): Promise<TgMessageReal[]> {
  const client = (tgManager as unknown as {
    clients: Map<string, unknown>;
  }).clients.get(sessionId);
  if (!client) throw new Error("Session not connected");

  const c = client as {
    getMessages: (
      entity: unknown,
      opts: { limit: number }
    ) => Promise<unknown[]>;
    getEntity: (id: string) => Promise<unknown>;
  };

  const entity = await c.getEntity(chatId);
  const msgs = await c.getMessages(entity, { limit: 50 });

  return msgs.map((m) => {
    const msg = m as {
      id?: number;
      message?: string;
      date?: number;
      out?: boolean;
      senderId?: { toString: () => string };
    };
    return {
      id: String(msg.id ?? ""),
      text: msg.message ?? "",
      date: (msg.date ?? 0) * 1000,
      outgoing: !!msg.out,
      senderName: msg.out ? "You" : "Them",
    };
  }).reverse();
}

export async function sendRealMessage(
  sessionId: string,
  chatId: string,
  text: string
): Promise<void> {
  const client = (tgManager as unknown as {
    clients: Map<string, unknown>;
  }).clients.get(sessionId);
  if (!client) throw new Error("Session not connected");

  const c = client as {
    sendMessage: (entity: unknown, opts: { message: string }) => Promise<unknown>;
    getEntity: (id: string) => Promise<unknown>;
  };

  const entity = await c.getEntity(chatId);
  await c.sendMessage(entity, { message: text });
}
