// Telegram Bot API client.
// Uses the bot token from env.

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
  document?: { file_id: string; file_name?: string; mime_type?: string };
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message: TelegramMessage;
  data?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
}

export class TelegramBot {
  private baseUrl: string;

  constructor(private token: string) {
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  private async call<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json()) as { ok: boolean; result: T; description?: string };
    if (!data.ok) throw new Error(`Telegram API ${method}: ${data.description ?? "unknown"}`);
    return data.result;
  }

  // ===== Send messages =====
  sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parse_mode?: "HTML" | "MarkdownV2";
      reply_markup?: unknown;
      disable_web_page_preview?: boolean;
    }
  ) {
    return this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
      disable_web_page_preview: options?.disable_web_page_preview ?? true,
    });
  }

  editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: { parse_mode?: "HTML" | "MarkdownV2"; reply_markup?: unknown }
  ) {
    return this.call("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
    });
  }

  editMessageCaption(
    chatId: number | string,
    messageId: number,
    caption: string,
    options?: { parse_mode?: "HTML" | "MarkdownV2"; reply_markup?: unknown }
  ) {
    return this.call("editMessageCaption", {
      chat_id: chatId,
      message_id: messageId,
      caption,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
    });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean) {
    return this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert ?? false,
    });
  }

  sendPhoto(
    chatId: number | string,
    photoUrl: string,
    options?: {
      caption?: string;
      parse_mode?: "HTML" | "MarkdownV2";
      reply_markup?: unknown;
    }
  ) {
    return this.call("sendPhoto", {
      chat_id: chatId,
      photo: photoUrl,
      caption: options?.caption,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
    });
  }
  copyMessage(
    chatId: number | string,
    fromChatId: number | string,
    messageId: number,
    options?: { caption?: string; reply_markup?: unknown }
  ) {
    return this.call("copyMessage", {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      caption: options?.caption,
      reply_markup: options?.reply_markup,
    });
  }

  // ===== Webhook =====
  setWebhook(url: string, secretToken?: string) {
    return this.call("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
  }

  deleteWebhook() {
    return this.call("deleteWebhook", { drop_pending_updates: true });
  }

  getMe() {
    return this.call("getMe");
  }

  getFile(fileId: string) {
    return this.call<{ file_id: string; file_path: string }>("getFile", { file_id: fileId });
  }
}
