// Telegram Capability
//
// This is the layer that:
//   - Exposes Telegram operations to the rest of Raymond
//   - Wires events (e.g. telegram.message.received)
//   - Provides AI tools (deleteChat, sendMessage, ...)
//
// It uses the TelegramContract — which backend is behind it doesn't matter.

import { getTelegram } from "../../runtime";

export const telegramCapability = {
  manifest: {
    id: "telegram",
    name: "Telegram",
    version: "0.1.0",
    description: "Telegram client (MTProto) — multi-account",
    events_subscribed: ["telegram.message.send.requested"],
    events_published: ["telegram.message.sent", "telegram.message.received"],
  },

  async listAccounts() {
    const tg = getTelegram();
    if (!tg) throw new Error("Telegram not ready");
    return tg.listAccounts();
  },

  async listChats(sessionId: string) {
    const tg = getTelegram();
    if (!tg) throw new Error("Telegram not ready");
    return tg.listChats(sessionId);
  },

  async listMessages(sessionId: string, chatId: string) {
    const tg = getTelegram();
    if (!tg) throw new Error("Telegram not ready");
    return tg.listMessages(sessionId, chatId);
  },

  async sendMessage(sessionId: string, chatId: string, text: string) {
    const tg = getTelegram();
    if (!tg) throw new Error("Telegram not ready");
    return tg.sendMessage(sessionId, chatId, text);
  },

  async deleteChat(sessionId: string, chatId: string) {
    const tg = getTelegram();
    if (!tg) throw new Error("Telegram not ready");
    return tg.deleteChat(sessionId, chatId);
  },
};
