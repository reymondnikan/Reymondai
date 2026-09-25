// Telegram bot main handler.

import type { Env } from "../core/db";
import { queryAll, queryFirst, run } from "../core/db";
import { TelegramBot, type TelegramUpdate, type TelegramUser } from "./telegram-api";
import {
  mainMenuKeyboard,
  productsKeyboard,
  productDetailKeyboard,
  backToMainKeyboard,
  cancelKeyboard,
  adminOrderKeyboard,
  adminMenuKeyboard,
  formatPrice,
} from "./keyboards";

function newId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return prefix + "_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface ShopSettings {
  shop_name: string;
  shop_description: string;
  support_username: string;
  payment_card: string;
  payment_holder: string;
  welcome_message: string;
}

async function getSettings(env: Env): Promise<ShopSettings> {
  const rows = await queryAll<{ key: string; value: string }>(
    env.DB,
    "SELECT key, value FROM shop_settings"
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    try {
      map[r.key] = JSON.parse(r.value);
    } catch {
      map[r.key] = r.value;
    }
  }
  return {
    shop_name: map.shop_name ?? "Raymond VPN",
    shop_description: map.shop_description ?? "",
    support_username: map.support_username ?? "",
    payment_card: map.payment_card ?? "",
    payment_holder: map.payment_holder ?? "",
    welcome_message: map.welcome_message ?? "ط®ظˆط´ ط¢ظ…ط¯غŒط¯",
  };
}

async function upsertBotUser(env: Env, u: TelegramUser, isAdmin: boolean): Promise<void> {
  const now = Date.now();
  const existing = await queryFirst<{ telegram_id: string }>(
    env.DB,
    "SELECT telegram_id FROM bot_users WHERE telegram_id = ? LIMIT 1",
    String(u.id)
  );
  if (existing) {
    await run(
      env.DB,
      "UPDATE bot_users SET username = ?, first_name = ?, last_name = ?, last_seen = ?, is_admin = ? WHERE telegram_id = ?",
      u.username ?? null,
      u.first_name ?? null,
      u.last_name ?? null,
      now,
      isAdmin ? 1 : 0,
      String(u.id)
    );
  } else {
    await run(
      env.DB,
      "INSERT INTO bot_users (telegram_id, username, first_name, last_name, is_admin, state, state_data, created_at, last_seen) VALUES (?, ?, ?, ?, ?, 'idle', '{}', ?, ?)",
      String(u.id),
      u.username ?? null,
      u.first_name ?? null,
      u.last_name ?? null,
      isAdmin ? 1 : 0,
      now,
      now
    );
  }
}

async function setUserState(env: Env, telegramId: string, state: string, stateData: Record<string, unknown> = {}): Promise<void> {
  await run(
    env.DB,
    "UPDATE bot_users SET state = ?, state_data = ? WHERE telegram_id = ?",
    state,
    JSON.stringify(stateData),
    telegramId
  );
}

async function getUserState(env: Env, telegramId: string): Promise<{ state: string; state_data: Record<string, unknown> } | null> {
  const u = await queryFirst<{ state: string; state_data: string }>(
    env.DB,
    "SELECT state, state_data FROM bot_users WHERE telegram_id = ? LIMIT 1",
    telegramId
  );
  if (!u) return null;
  return {
    state: u.state ?? "idle",
    state_data: (() => {
      try {
        return JSON.parse(u.state_data);
      } catch {
        return {};
      }
    })(),
  };
}

// ============================================================
// Main dispatcher
// ============================================================
export async function handleUpdate(env: Env, update: TelegramUpdate): Promise<void> {
  const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN!);
  const adminId = env.TELEGRAM_ADMIN_ID!;

  if (update.callback_query) {
    await handleCallback(env, bot, update.callback_query, adminId);
    return;
  }

  if (update.message) {
    await handleMessage(env, bot, update.message, adminId);
    return;
  }
}

async function handleMessage(
  env: Env,
  bot: TelegramBot,
  msg: NonNullable<TelegramUpdate["message"]>,
  adminId: string
): Promise<void> {
  const from = msg.from;
  const isAdmin = String(from.id) === adminId;
  await upsertBotUser(env, from, isAdmin);

  const text = msg.text ?? "";
  const settings = await getSettings(env);

  if (text === "/start" || text === "/menu") {
    await setUserState(env, String(from.id), "idle");
    const welcome =
      "<b>" + settings.shop_name + "</b>\n" +
      settings.shop_description + "\n\n" +
      "ط³ظ„ط§ظ… <b>" + escapeHtml(from.first_name) + "</b> ًں‘‹\n\n" +
      "ط§ط² ظ…ظ†ظˆغŒ ط²غŒط± ط§ظ†طھط®ط§ط¨ ع©ظ†غŒط¯:";
    await bot.sendMessage(msg.chat.id, welcome, {
      reply_markup: mainMenuKeyboard(isAdmin),
    });
    return;
  }

  if (text === "/admin" && isAdmin) {
    await bot.sendMessage(msg.chat.id, "ًں”§ <b>ظ¾ظ†ظ„ ط§ط¯ظ…غŒظ†</b>\n\nط§ظ†طھط®ط§ط¨ ع©ظ†غŒط¯:", {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  if (msg.photo && msg.photo.length > 0) {
    await handleReceiptPhoto(env, bot, msg, adminId);
    return;
  }

  await bot.sendMessage(msg.chat.id, "ط¨ط±ط§غŒ ط´ط±ظˆط¹ /start ط±ظˆ ط¨ط²ظ†غŒط¯", {
    reply_markup: mainMenuKeyboard(isAdmin),
  });
}

// ============================================================
// Callback handler
// ============================================================
async function handleCallback(
  env: Env,
  bot: TelegramBot,
  cb: NonNullable<TelegramUpdate["callback_query"]>,
  adminId: string
): Promise<void> {
  const from = cb.from;
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data ?? "";
  const isAdmin = String(from.id) === adminId;
  await upsertBotUser(env, from, isAdmin);

  const settings = await getSettings(env);

  try {
    if (data === "back_main") {
      await setUserState(env, String(from.id), "idle");
      const welcome =
        "<b>" + settings.shop_name + "</b>\n\n" +
        "ط³ظ„ط§ظ… <b>" + escapeHtml(from.first_name) + "</b> ًں‘‹\n\n" +
        "ط§ط² ظ…ظ†ظˆغŒ ط²غŒط± ط§ظ†طھط®ط§ط¨ ع©ظ†غŒط¯:";
      await bot.editMessageText(chatId, messageId, welcome, {
        reply_markup: mainMenuKeyboard(isAdmin),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "buy") {
      const products = await queryAll<{
        id: string;
        name: string;
        price_toman: number;
        quota_gb: number;
        duration_days: number;
      }>(
        env.DB,
        "SELECT id, name, price_toman, quota_gb, duration_days FROM products WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC"
      );
      if (products.length === 0) {
        await bot.editMessageText(chatId, messageId, "â‌Œ ظپط¹ظ„ط§ظ‹ ظ…ط­طµظˆظ„غŒ ظ…ظˆط¬ظˆط¯ ظ†غŒط³طھ.", {
          reply_markup: backToMainKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }
      await bot.editMessageText(
        chatId,
        messageId,
        "ًں›’ <b>ظ¾ظ„ظ†â€Œظ‡ط§غŒ ظ…ظˆط¬ظˆط¯</b>\n\nغŒع©غŒ ط±ظˆ ط§ظ†طھط®ط§ط¨ ع©ظ†:",
        { reply_markup: productsKeyboard(products) }
      );
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("product_")) {
      const productId = data.slice("product_".length);
      const product = await queryFirst<{
        id: string;
        name: string;
        description: string;
        quota_gb: number;
        speed_mbps: number;
        duration_days: number;
        price_toman: number;
      }>(
        env.DB,
        "SELECT id, name, description, quota_gb, speed_mbps, duration_days, price_toman FROM products WHERE id = ? LIMIT 1",
        productId
      );
      if (!product) {
        await bot.answerCallbackQuery(cb.id, "ظ…ط­طµظˆظ„ ظ¾غŒط¯ط§ ظ†ط´ط¯", true);
        return;
      }
      const text =
        "ًں“¦ <b>" + escapeHtml(product.name) + "</b>\n\n" +
        "ًں“ٹ ط­ط¬ظ…: <b>" + product.quota_gb + " GB</b>\n" +
        "âڑ، ط³ط±ط¹طھ: <b>" + (product.speed_mbps > 0 ? product.speed_mbps + " Mbps" : "ط¨غŒâ€Œظ†ظ‡ط§غŒطھ") + "</b>\n" +
        "ًں“… ظ…ط¯طھ: <b>" + product.duration_days + " ط±ظˆط²</b>\n" +
        "ًں’° ظ‚غŒظ…طھ: <b>" + formatPrice(product.price_toman) + "</b>\n" +
        (product.description ? "\n" + escapeHtml(product.description) + "\n" : "");
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: productDetailKeyboard(productId),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("confirm_")) {
      const productId = data.slice("confirm_".length);
      const product = await queryFirst<{
        id: string;
        name: string;
        quota_gb: number;
        duration_days: number;
        price_toman: number;
      }>(
        env.DB,
        "SELECT id, name, quota_gb, duration_days, price_toman FROM products WHERE id = ? LIMIT 1",
        productId
      );
      if (!product) {
        await bot.answerCallbackQuery(cb.id, "ظ…ط­طµظˆظ„ ظ¾غŒط¯ط§ ظ†ط´ط¯", true);
        return;
      }

      await setUserState(env, String(from.id), "awaiting_receipt", {
        product_id: product.id,
        product_name: product.name,
      });

      const text =
        "ًں’³ <b>ظ¾ط±ط¯ط§ط®طھ</b>\n\n" +
        "ظ…ط¨ظ„ط؛ <b>" + formatPrice(product.price_toman) + "</b> ط±ظˆ ط¨ظ‡ ع©ط§ط±طھ ط²غŒط± ظˆط§ط±غŒط² ع©ظ†:\n\n" +
        "ًں’³ <b>" + settings.payment_card + "</b>\n" +
        "ًں‘¤ ط¨ظ‡ ظ†ط§ظ…: <b>" + settings.payment_holder + "</b>\n\n" +
        "ط¨ط¹ط¯ ط§ط² ظˆط§ط±غŒط²طŒ <b>ط¹ع©ط³ ظپغŒط´</b> ط±ظˆ ظ‡ظ…غŒظ†â€Œط¬ط§ ط¨ظپط±ط³طھ ًں“·";

      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: cancelKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "my_accounts") {
      const orders = await queryAll<{
        id: string;
        product_name: string;
        status: string;
        xray_user_name: string;
        xray_sub_token: string;
        created_at: number;
      }>(
        env.DB,
        "SELECT id, product_name, status, xray_user_name, xray_sub_token, created_at FROM orders WHERE user_telegram_id = ? ORDER BY created_at DESC LIMIT 20",
        String(from.id)
      );

      if (orders.length === 0) {
        await bot.editMessageText(chatId, messageId, "ًں“­ ظ‡ظ†ظˆط² ط§ع©ط§ظ†طھغŒ ظ†ط¯ط§ط±غŒ.", {
          reply_markup: backToMainKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }

      let text = "ًں“¦ <b>ط§ع©ط§ظ†طھâ€Œظ‡ط§غŒ ط´ظ…ط§</b>\n\n";
      for (const o of orders) {
        const status =
          o.status === "completed"
            ? "âœ… ظپط¹ط§ظ„"
            : o.status === "pending_approval"
            ? "âڈ³ ط¯ط± ط§ظ†طھط¸ط§ط± طھط§غŒغŒط¯"
            : o.status === "rejected"
            ? "â‌Œ ط±ط¯ ط´ط¯ظ‡"
            : "âڈ³";
        text += "â€¢ <b>" + escapeHtml(o.product_name) + "</b> â€” " + status + "\n";
        if (o.xray_sub_token && o.status === "completed") {
          const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + o.xray_sub_token;
          text += "  ًں”— <code>" + subUrl + "</code>\n";
        }
        text += "\n";
      }
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: backToMainKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "help") {
      const text =
        "â‌“ <b>ط±ط§ظ‡ظ†ظ…ط§</b>\n\n" +
        "1ï¸ڈâƒ£ ط§ط² ظ…ظ†ظˆغŒ ط§طµظ„غŒ آ«ط®ط±غŒط¯ ط§ع©ط§ظ†طھآ» ط±ظˆ ط¨ط²ظ†\n" +
        "2ï¸ڈâƒ£ ظ¾ظ„ظ† ظ…ظˆط±ط¯ ظ†ط¸ط± ط±ظˆ ط§ظ†طھط®ط§ط¨ ع©ظ†\n" +
        "3ï¸ڈâƒ£ ظ…ط¨ظ„ط؛ ط±ظˆ ط¨ظ‡ ع©ط§ط±طھ ظˆط§ط±غŒط² ع©ظ†\n" +
        "4ï¸ڈâƒ£ ط¹ع©ط³ ظپغŒط´ ط±ظˆ ط§ط±ط³ط§ظ„ ع©ظ†\n" +
        "5ï¸ڈâƒ£ ط¨ط¹ط¯ ط§ط² طھط§غŒغŒط¯ ط§ط¯ظ…غŒظ†طŒ ظ„غŒظ†ع© ط§طھطµط§ظ„ ط¨ط±ط§طھ ط§ط±ط³ط§ظ„ ظ…غŒâ€Œط´ظ‡\n\n" +
        "ًں“± ظ„غŒظ†ع© ط±ظˆ طھظˆغŒ <b>V2Box</b> غŒط§ <b>Hiddify</b> import ع©ظ†.";
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: backToMainKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "support") {
      const text = "ًں’¬ <b>ظ¾ط´طھغŒط¨ط§ظ†غŒ</b>\n\nط¨ط±ط§غŒ ط§ط±طھط¨ط§ط·: " + settings.support_username;
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: backToMainKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("approve_") && isAdmin) {
      const orderId = data.slice("approve_".length);
      await approveOrder(env, bot, orderId, String(from.id), chatId, messageId);
      await bot.answerCallbackQuery(cb.id, "طھط§غŒغŒط¯ ط´ط¯ âœ…");
      return;
    }

    if (data.startsWith("reject_") && isAdmin) {
      const orderId = data.slice("reject_".length);
      await rejectOrder(env, bot, orderId, chatId, messageId);
      await bot.answerCallbackQuery(cb.id, "ط±ط¯ ط´ط¯ â‌Œ");
      return;
    }

    if (data === "admin_panel" && isAdmin) {
      await bot.editMessageText(chatId, messageId, "ًں”§ <b>ظ¾ظ†ظ„ ط§ط¯ظ…غŒظ†</b>", {
        reply_markup: adminMenuKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "admin_pending" && isAdmin) {
      const orders = await queryAll<{
        id: string;
        user_telegram_id: string;
        user_username: string;
        product_name: string;
        price_toman: number;
      }>(
        env.DB,
        "SELECT id, user_telegram_id, user_username, product_name, price_toman FROM orders WHERE status = 'pending_approval' ORDER BY created_at ASC LIMIT 10"
      );
      if (orders.length === 0) {
        await bot.editMessageText(chatId, messageId, "ًں“­ ط³ظپط§ط±ط´ ط¯ط± ط§ظ†طھط¸ط§ط±غŒ ظ†ط¯ط§ط±غŒ.", {
          reply_markup: adminMenuKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }
      let text = "ًں“‹ <b>" + orders.length + " ط³ظپط§ط±ط´ ط¯ط± ط§ظ†طھط¸ط§ط±</b>\n\n";
      for (const o of orders) {
        text += "â€¢ <b>" + escapeHtml(o.product_name) + "</b> â€” " + formatPrice(o.price_toman) + "\n";
        text += "  ع©ط§ط±ط¨ط±: @" + (o.user_username ?? o.user_telegram_id) + "\n";
        text += "  ID: <code>" + o.id + "</code>\n\n";
      }
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: adminMenuKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "admin_stats" && isAdmin) {
      const total = await queryFirst<{ c: number }>(env.DB, "SELECT COUNT(*) as c FROM orders");
      const pending = await queryFirst<{ c: number }>(
        env.DB,
        "SELECT COUNT(*) as c FROM orders WHERE status = 'pending_approval'"
      );
      const completed = await queryFirst<{ c: number }>(
        env.DB,
        "SELECT COUNT(*) as c FROM orders WHERE status = 'completed'"
      );
      const revenue = await queryFirst<{ s: number }>(
        env.DB,
        "SELECT COALESCE(SUM(price_toman), 0) as s FROM orders WHERE status = 'completed'"
      );

      const text =
        "ًں“ٹ <b>ط¢ظ…ط§ط± ظپط±ظˆط´</b>\n\n" +
        "ع©ظ„ ط³ظپط§ط±ط´â€Œظ‡ط§: <b>" + (total?.c ?? 0) + "</b>\n" +
        "ط¯ط± ط§ظ†طھط¸ط§ط± طھط§غŒغŒط¯: <b>" + (pending?.c ?? 0) + "</b>\n" +
        "طھط§غŒغŒط¯ ط´ط¯ظ‡: <b>" + (completed?.c ?? 0) + "</b>\n" +
        "ط¯ط±ط¢ظ…ط¯ ع©ظ„: <b>" + formatPrice(revenue?.s ?? 0) + "</b>";

      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: adminMenuKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    await bot.answerCallbackQuery(cb.id);
  } catch (err) {
    console.error("handleCallback error:", err);
    try {
      await bot.answerCallbackQuery(cb.id, "ط®ط·ط§: " + String(err).slice(0, 180), true);
    } catch {}
  }
}

// ============================================================
// Receipt photo handler
// ============================================================
async function handleReceiptPhoto(
  env: Env,
  bot: TelegramBot,
  msg: NonNullable<TelegramUpdate["message"]>,
  adminId: string
): Promise<void> {
  const from = msg.from;
  const state = await getUserState(env, String(from.id));

  if (!state || state.state !== "awaiting_receipt") {
    await bot.sendMessage(
      msg.chat.id,
      "âڑ ï¸ڈ ط§ظˆظ„ غŒظ‡ ظ¾ظ„ظ† ط§ظ†طھط®ط§ط¨ ع©ظ† ظˆ ظپغŒط´ ط±ظˆ ط§ط² ط§ظˆظ† ظ…ط³غŒط± ط¨ظپط±ط³طھ.\n/start",
      { reply_markup: backToMainKeyboard() }
    );
    return;
  }

  const productId = state.state_data.product_id as string;
  const product = await queryFirst<{
    id: string;
    name: string;
    quota_gb: number;
    speed_mbps: number;
    duration_days: number;
    price_toman: number;
  }>(
    env.DB,
    "SELECT id, name, quota_gb, speed_mbps, duration_days, price_toman FROM products WHERE id = ? LIMIT 1",
    productId
  );

  if (!product) {
    await bot.sendMessage(msg.chat.id, "â‌Œ ظ…ط­طµظˆظ„ ظ¾غŒط¯ط§ ظ†ط´ط¯طŒ ط¯ظˆط¨ط§ط±ظ‡ ط´ط±ظˆط¹ ع©ظ†.");
    await setUserState(env, String(from.id), "idle");
    return;
  }

  const orderId = newId("ord");
  const now = Date.now();
  const photo = msg.photo![msg.photo!.length - 1];

  await run(
    env.DB,
    `INSERT INTO orders 
      (id, user_telegram_id, user_username, user_first_name, product_id, product_name, product_snapshot,
       price_toman, status, receipt_file_id, receipt_chat_id, receipt_message_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?, ?)`,
    orderId,
    String(from.id),
    from.username ?? null,
    from.first_name ?? null,
    product.id,
    product.name,
    JSON.stringify(product),
    product.price_toman,
    photo.file_id,
    String(msg.chat.id),
    String(msg.message_id),
    now,
    now
  );

  await bot.sendMessage(
    msg.chat.id,
    "âœ… ظپغŒط´ ط´ظ…ط§ ط¯ط±غŒط§ظپطھ ط´ط¯!\n\nâڈ³ ط¯ط± ط§ظ†طھط¸ط§ط± طھط§غŒغŒط¯ ط§ط¯ظ…غŒظ†...\n\nط¨ط¹ط¯ ط§ط² طھط§غŒغŒط¯طŒ ظ„غŒظ†ع© ط§طھطµط§ظ„ ط¨ط±ط§طھ ط§ط±ط³ط§ظ„ ظ…غŒâ€Œط´ظ‡.",
    { reply_markup: backToMainKeyboard() }
  );

  const adminText =
    "ًں”” <b>ط³ظپط§ط±ط´ ط¬ط¯غŒط¯</b>\n\n" +
    "ًں‘¤ ع©ط§ط±ط¨ط±: " + escapeHtml(from.first_name) + (from.username ? " (@" + from.username + ")" : "") + "\n" +
    "ًں†” Telegram ID: <code>" + from.id + "</code>\n\n" +
    "ًں“¦ ظ…ط­طµظˆظ„: <b>" + escapeHtml(product.name) + "</b>\n" +
    "ًں“ٹ " + product.quota_gb + " GB / " + product.duration_days + " ط±ظˆط²\n" +
    "ًں’° <b>" + formatPrice(product.price_toman) + "</b>\n\n" +
    "ID ط³ظپط§ط±ط´: <code>" + orderId + "</code>";

  try {
    await bot.copyMessage(adminId, msg.chat.id, msg.message_id, {
      caption: adminText,
      reply_markup: adminOrderKeyboard(orderId),
    });
  } catch (err) {
    console.error("copyMessage to admin failed:", err);
    await bot.sendMessage(adminId, adminText, {
      reply_markup: adminOrderKeyboard(orderId),
    });
  }

  await setUserState(env, String(from.id), "idle");
}

// ============================================================
// Order approval â€” direct DB + node task (no HTTP)
// ============================================================
async function approveOrder(
  env: Env,
  bot: TelegramBot,
  orderId: string,
  adminTelegramId: string,
  adminChatId: number,
  adminMessageId: number
): Promise<void> {
  const order = await queryFirst<{
    id: string;
    user_telegram_id: string;
    product_id: string;
    product_name: string;
    product_snapshot: string;
    status: string;
  }>(
    env.DB,
    "SELECT id, user_telegram_id, product_id, product_name, product_snapshot, status FROM orders WHERE id = ? LIMIT 1",
    orderId
  );

  if (!order) {
    await bot.editMessageCaption(adminChatId, adminMessageId, "❌ سفارش پیدا نشد", {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  if (order.status === "completed") {
    await bot.editMessageCaption(adminChatId, adminMessageId, "⚠️ این سفارش قبلاً تایید شده", {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  const snapshot = JSON.parse(order.product_snapshot) as {
    quota_gb: number;
    speed_mbps: number;
    duration_days: number;
  };

  const xrayUserName = "tg" + order.user_telegram_id + "_" + randomHex(3);

  try {
    const { NodeClient } = await import("../adapters/ai/node-client");
    const node = new NodeClient(env, "hetzner-nbg1-01");

    const uuidRes = await node.task<{ stdout: string }>("xray.uuid");
    if (!uuidRes.ok || !uuidRes.output) {
      throw new Error("uuid generation failed: " + (uuidRes.error ?? "unknown"));
    }
    const uuid = uuidRes.output.stdout.trim();

    const id = "xu_" + randomHex(12);
    const publicToken = randomHex(16);
    const emailTag = xrayUserName + "@raymond";
    const now = Date.now();
    const expiresAt = snapshot.duration_days > 0 ? now + snapshot.duration_days * 86400000 : null;

    await run(
      env.DB,
      "INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)",
      id, xrayUserName, uuid, emailTag, snapshot.quota_gb, snapshot.speed_mbps, now, now, expiresAt, snapshot.duration_days, publicToken
    );

    const users = await queryAll<{ name: string; uuid: string }>(
      env.DB,
      "SELECT name, uuid FROM xray_users WHERE enabled = 1 ORDER BY created_at ASC"
    );

    const usersData = users.map((u) => ({
      name: u.name,
      uuid: u.uuid,
      enabled: true,
      created_at: Date.now(),
    }));

    const json = JSON.stringify(usersData, null, 2);
    const b64 = btoa(unescape(encodeURIComponent(json)));

    const script = "echo '" + b64 + "' | base64 -d | sudo tee /usr/local/etc/xray/users.json > /dev/null && sudo chown raymond:raymond /usr/local/etc/xray/users.json && bash ~/raymond-node/scripts/xray-sync.sh && sudo systemctl restart xray && echo SYNC_DONE";

    const syncRes = await node.task<{ stdout: string; stderr: string }>(
      "shell.exec",
      { cmd: script },
      60000
    );

    if (!syncRes.ok || !syncRes.output || !syncRes.output.stdout.includes("SYNC_DONE")) {
      console.error("sync error:", syncRes.error, syncRes.output);
    }

    await run(
      env.DB,
      "UPDATE orders SET status = 'completed', approved_by = ?, approved_at = ?, xray_user_name = ?, xray_sub_token = ?, updated_at = ? WHERE id = ?",
      adminTelegramId,
      now,
      xrayUserName,
      publicToken,
      now,
      orderId
    );

    const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + publicToken;
    const userText =
      "🎉 <b>پرداخت شما تایید شد!</b>\n\n" +
      "📦 محصول: <b>" + escapeHtml(order.product_name) + "</b>\n" +
      "📊 حجم: <b>" + snapshot.quota_gb + " GB</b>\n" +
      "⚡ سرعت: <b>" + (snapshot.speed_mbps > 0 ? snapshot.speed_mbps + " Mbps" : "بی‌نهایت") + "</b>\n" +
      "📅 مدت: <b>" + snapshot.duration_days + " روز</b>\n\n" +
      "🔗 <b>لینک اتصال:</b>\n" +
      "<code>" + subUrl + "</code>\n\n" +
      "📱 این لینک رو توی V2Box یا Hiddify import کن.";

    await bot.sendMessage(order.user_telegram_id, userText);

    await bot.editMessageCaption(
      adminChatId,
      adminMessageId,
      "✅ <b>سفارش تایید شد</b>\n\n👤 " + order.user_telegram_id + "\n📦 " + escapeHtml(order.product_name) + "\n🔑 " + xrayUserName,
      { reply_markup: adminMenuKeyboard() }
    );
  } catch (err) {
    console.error("approveOrder error:", err);
    try {
      await bot.editMessageCaption(
        adminChatId,
        adminMessageId,
        "❌ <b>خطا در تایید</b>\n\n<code>" + escapeHtml(String(err)).slice(0, 400) + "</code>",
        { reply_markup: adminMenuKeyboard() }
      );
    } catch (e2) {
      console.error("editMessageCaption also failed:", e2);
    }
  }
}

async function rejectOrder(
  env: Env,
  bot: TelegramBot,
  orderId: string,
  adminChatId: number,
  adminMessageId: number
): Promise<void> {
  const order = await queryFirst<{
    id: string;
    user_telegram_id: string;
    product_name: string;
    status: string;
  }>(
    env.DB,
    "SELECT id, user_telegram_id, product_name, status FROM orders WHERE id = ? LIMIT 1",
    orderId
  );

  if (!order) {
    await bot.editMessageCaption(adminChatId, adminMessageId, "❌ سفارش پیدا نشد", {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  await run(
    env.DB,
    "UPDATE orders SET status = 'rejected', updated_at = ? WHERE id = ?",
    Date.now(),
    orderId
  );

  await bot.sendMessage(
    order.user_telegram_id,
    "❌ <b>سفارش شما رد شد</b>\n\n📦 " + escapeHtml(order.product_name) + "\n\nبرای اطلاعات بیشتر با پشتیبانی تماس بگیرید."
  );

  await bot.editMessageCaption(adminChatId, adminMessageId, "❌ سفارش رد شد", {
    reply_markup: adminMenuKeyboard(),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
