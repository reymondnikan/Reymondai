// Mock Telegram adapter.
//
// Purpose: lets us build the UI NOW, without MTProto.
// When we plug in mtcute/GramJS later, we just swap this file's
// export with the real adapter. Same TelegramContract interface.

import type {
  TelegramContract,
  TgAccount,
  TgChat,
  TgMessage,
  TgLoginStart,
  TgLoginComplete,
} from "../../core/contracts";

const DEMO_ACCOUNT: TgAccount = {
  id: "demo_account_1",
  phone: "+98 912 *** 1234",
  username: "godfather",
  firstName: "Owner",
  lastName: "",
  status: "active",
  createdAt: Date.now() - 86400000 * 30,
  lastSeen: Date.now(),
};

function demoChats(): TgChat[] {
  const now = Date.now();
  return [
    {
      id: "chat_saved",
      accountId: DEMO_ACCOUNT.id,
      type: "user",
      title: "Saved Messages",
      unreadCount: 0,
      lastMessageAt: now - 1000 * 60 * 5,
      lastMessagePreview: "Notes to self…",
      pinned: true,
      muted: false,
    },
    {
      id: "chat_ray",
      accountId: DEMO_ACCOUNT.id,
      type: "bot",
      title: "Raymond Bot",
      username: "@raymond_bot",
      unreadCount: 2,
      lastMessageAt: now - 1000 * 60 * 30,
      lastMessagePreview: "Welcome to Raymond",
      pinned: true,
      muted: false,
    },
    {
      id: "chat_devs",
      accountId: DEMO_ACCOUNT.id,
      type: "group",
      title: "Dev Group",
      unreadCount: 5,
      lastMessageAt: now - 1000 * 60 * 60 * 2,
      lastMessagePreview: "Ali: I pushed the fix",
      pinned: false,
      muted: false,
    },
    {
      id: "chat_news",
      accountId: DEMO_ACCOUNT.id,
      type: "channel",
      title: "Tech News",
      username: "@technews",
      unreadCount: 12,
      lastMessageAt: now - 1000 * 60 * 60 * 6,
      lastMessagePreview: "OpenAI released…",
      pinned: false,
      muted: true,
    },
    {
      id: "chat_ali",
      accountId: DEMO_ACCOUNT.id,
      type: "user",
      title: "Ali",
      username: "@ali",
      unreadCount: 0,
      lastMessageAt: now - 1000 * 60 * 60 * 24,
      lastMessagePreview: "See you tomorrow",
      pinned: false,
      muted: false,
    },
  ];
}

function demoMessages(chatId: string): TgMessage[] {
  const now = Date.now();
  const base = [
    { text: "Hey, how are you?", outgoing: false },
    { text: "Good! Working on Raymond.", outgoing: true },
    { text: "Nice. Is it on Cloudflare?", outgoing: false },
    { text: "Yeah. Free tier.", outgoing: true },
    { text: "Let me know when it's ready.", outgoing: false },
  ];
  return base.map((b, i) => ({
    id: `msg_${chatId}_${i}`,
    chatId,
    accountId: DEMO_ACCOUNT.id,
    senderId: b.outgoing ? "me" : "them",
    senderName: b.outgoing ? "You" : "Them",
    text: b.text,
    date: now - (base.length - i) * 1000 * 60 * 3,
    outgoing: b.outgoing,
  }));
}

export class MockTelegram implements TelegramContract {
  async listAccounts(): Promise<TgAccount[]> {
    return [DEMO_ACCOUNT];
  }

  async getAccount(sessionId: string): Promise<TgAccount | null> {
    return sessionId === DEMO_ACCOUNT.id ? DEMO_ACCOUNT : null;
  }

  async startLogin(phone: string): Promise<TgLoginStart> {
    return { sessionId: "demo_account_1", phone, status: "code_sent" };
  }

  async completeLogin(_input: TgLoginComplete): Promise<TgAccount> {
    return DEMO_ACCOUNT;
  }

  async removeAccount(_sessionId: string): Promise<void> {
    // no-op for mock
  }

  async listChats(_sessionId: string, limit = 100): Promise<TgChat[]> {
    return demoChats().slice(0, limit);
  }

  async getChat(_sessionId: string, chatId: string): Promise<TgChat | null> {
    return demoChats().find((c) => c.id === chatId) ?? null;
  }

  async deleteChat(_sessionId: string, _chatId: string): Promise<void> {
    // no-op for mock
  }

  async pinChat(_sessionId: string, _chatId: string, _pinned: boolean): Promise<void> {
    // no-op
  }

  async muteChat(_sessionId: string, _chatId: string, _muted: boolean): Promise<void> {
    // no-op
  }

  async listMessages(
    _sessionId: string,
    chatId: string,
    limit = 50
  ): Promise<TgMessage[]> {
    return demoMessages(chatId).slice(-limit);
  }

  async sendMessage(
    _sessionId: string,
    chatId: string,
    text: string
  ): Promise<TgMessage> {
    return {
      id: `msg_new_${Date.now()}`,
      chatId,
      accountId: DEMO_ACCOUNT.id,
      senderId: "me",
      senderName: "You",
      text,
      date: Date.now(),
      outgoing: true,
    };
  }

  async editMessage(
    _sessionId: string,
    _chatId: string,
    _messageId: string,
    _text: string
  ): Promise<void> {
    // no-op
  }

  async deleteMessage(
    _sessionId: string,
    _chatId: string,
    _messageId: string
  ): Promise<void> {
    // no-op
  }

  async isReady(_sessionId: string): Promise<boolean> {
    return true;
  }
}
