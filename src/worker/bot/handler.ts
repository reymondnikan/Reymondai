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
  myAccountsKeyboard,
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
    welcome_message: map.welcome_message ?? "",
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
      "سلام <b>" + escapeHtml(from.first_name) + "</b> 👋\n\n" +
      "از منوی زیر انتخاب کنید:";
    await bot.sendMessage(msg.chat.id, welcome, { reply_markup: mainMenuKeyboard(isAdmin) });
    return;
  }

  if (text === "/admin" && isAdmin) {
    await bot.sendMessage(msg.chat.id, "🔧 <b>پنل ادمین</b>\n\nانتخاب کنید:", {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  if (msg.photo && msg.photo.length > 0) {
    await handleReceiptPhoto(env, bot, msg, adminId);
    return;
  }

  await bot.sendMessage(msg.chat.id, "برای شروع /start رو بزنید", {
    reply_markup: mainMenuKeyboard(isAdmin),
  });
}

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
        "سلام <b>" + escapeHtml(from.first_name) + "</b> 👋\n\n" +
        "از منوی زیر انتخاب کنید:";
      await bot.editMessageText(chatId, messageId, welcome, { reply_markup: mainMenuKeyboard(isAdmin) });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "buy") {
      const products = await queryAll<{ id: string; name: string; price_toman: number; quota_gb: number; duration_days: number }>(
        env.DB,
        "SELECT id, name, price_toman, quota_gb, duration_days FROM products WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC"
      );
      if (products.length === 0) {
        await bot.editMessageText(chatId, messageId, "❌ فعلاً محصولی موجود نیست.", { reply_markup: backToMainKeyboard() });
        await bot.answerCallbackQuery(cb.id);
        return;
      }
      await bot.editMessageText(chatId, messageId, "🛒 <b>پلن‌های موجود</b>\n\nیکی رو انتخاب کن:", { reply_markup: productsKeyboard(products) });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("product_")) {
      const productId = data.slice("product_".length);
      const product = await queryFirst<{ id: string; name: string; description: string; quota_gb: number; speed_mbps: number; duration_days: number; price_toman: number }>(
        env.DB,
        "SELECT id, name, description, quota_gb, speed_mbps, duration_days, price_toman FROM products WHERE id = ? LIMIT 1",
        productId
      );
      if (!product) {
        await bot.answerCallbackQuery(cb.id, "محصول پیدا نشد", true);
        return;
      }
      const text =
        "📦 <b>" + escapeHtml(product.name) + "</b>\n\n" +
        "📊 حجم: <b>" + product.quota_gb + " GB</b>\n" +
        "⚡ سرعت: <b>" + (product.speed_mbps > 0 ? product.speed_mbps + " Mbps" : "بی‌نهایت") + "</b>\n" +
        "📅 مدت: <b>" + product.duration_days + " روز</b>\n" +
        "💰 قیمت: <b>" + formatPrice(product.price_toman) + "</b>\n" +
        (product.description ? "\n" + escapeHtml(product.description) + "\n" : "");
      await bot.editMessageText(chatId, messageId, text, { reply_markup: productDetailKeyboard(productId) });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("confirm_")) {
      const productId = data.slice("confirm_".length);
      const product = await queryFirst<{ id: string; name: string; quota_gb: number; duration_days: number; price_toman: number }>(
        env.DB,
        "SELECT id, name, quota_gb, duration_days, price_toman FROM products WHERE id = ? LIMIT 1",
        productId
      );
      if (!product) {
        await bot.answerCallbackQuery(cb.id, "محصول پیدا نشد", true);
        return;
      }
      await setUserState(env, String(from.id), "awaiting_receipt", { product_id: product.id, product_name: product.name });
      const text =
        "💳 <b>پرداخت</b>\n\n" +
        "مبلغ <b>" + formatPrice(product.price_toman) + "</b> رو به کارت زیر واریز کن:\n\n" +
        "💳 <b>" + settings.payment_card + "</b>\n" +
        "👤 به نام: <b>" + settings.payment_holder + "</b>\n\n" +
        "بعد از واریز، <b>عکس فیش</b> رو همین‌جا بفرست 📷";
      await bot.editMessageText(chatId, messageId, text, { reply_markup: cancelKeyboard() });
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
        await bot.editMessageText(chatId, messageId, L("📭 هنوز اکانتی نداری."), {
          reply_markup: backToMainKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }

      let text = L("📦 اکانت‌های شما") + "\n\n";
      const completedOrders: Array<{ id: string; xray_sub_token: string | null; status: string }> = [];
      
      for (const o of orders) {
        const status =
          o.status === "completed"
            ? L("✅ فعال")
            : o.status === "pending_approval"
            ? L("⏳ در انتظار تایید")
            : o.status === "rejected"
            ? L("❌ رد شده")
            : L("⏳");
        text += L("•") + " <b>" + escapeHtml(o.product_name) + "</b> — " + status + "\n";
        if (o.xray_sub_token && o.status === "completed") {
          const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + o.xray_sub_token;
          text += "  " + L("🔗") + " <code>" + subUrl + "</code>\n";
          completedOrders.push({ id: o.id, xray_sub_token: o.xray_sub_token, status: o.status });
        }
        text += "\n";
      }
      
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: myAccountsKeyboard(completedOrders),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "help") {
      const text =
        "❓ <b>راهنما</b>\n\n" +
        "1️⃣ از منوی اصلی «خرید اکانت» رو بزن\n" +
        "2️⃣ پلن مورد نظر رو انتخاب کن\n" +
        "3️⃣ مبلغ رو به کارت واریز کن\n" +
        "4️⃣ عکس فیش رو ارسال کن\n" +
        "5️⃣ بعد از تایید ادمین، لینک اتصال برات ارسال می‌شه\n\n" +
        "📱 لینک رو توی V2Box یا Hiddify import کن.";
      await bot.editMessageText(chatId, messageId, text, { reply_markup: backToMainKeyboard() });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "support") {
      const text = "💬 <b>پشتیبانی</b>\n\nبرای ارتباط: " + settings.support_username;
      await bot.editMessageText(chatId, messageId, text, { reply_markup: backToMainKeyboard() });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("approve_") && isAdmin) {
      const orderId = data.slice("approve_".length);
      await approveOrder(env, bot, orderId, String(from.id), chatId, messageId);
      await bot.answerCallbackQuery(cb.id, "تایید شد ✅");
      return;
    }

    if (data.startsWith("reject_") && isAdmin) {
      const orderId = data.slice("reject_".length);
      await rejectOrder(env, bot, orderId, chatId, messageId);
      await bot.answerCallbackQuery(cb.id, "رد شد ❌");
      return;
    }

    if (data === "admin_panel" && isAdmin) {
      await bot.editMessageText(chatId, messageId, "🔧 <b>پنل ادمین</b>", { reply_markup: adminMenuKeyboard() });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "admin_pending" && isAdmin) {
      const orders = await queryAll<{ id: string; user_telegram_id: string; user_username: string; product_name: string; price_toman: number }>(
        env.DB,
        "SELECT id, user_telegram_id, user_username, product_name, price_toman FROM orders WHERE status = 'pending_approval' ORDER BY created_at ASC LIMIT 10"
      );
      if (orders.length === 0) {
        await bot.editMessageText(chatId, messageId, "📭 سفارش در انتظاری نداری.", { reply_markup: adminMenuKeyboard() });
        await bot.answerCallbackQuery(cb.id);
        return;
      }
      let text = "📋 <b>" + orders.length + " سفارش در انتظار</b>\n\n";
      for (const o of orders) {
        text += "• <b>" + escapeHtml(o.product_name) + "</b> — " + formatPrice(o.price_toman) + "\n";
        text += "  کاربر: @" + (o.user_username ?? o.user_telegram_id) + "\n";
        text += "  ID: <code>" + o.id + "</code>\n\n";
      }
      await bot.editMessageText(chatId, messageId, text, { reply_markup: adminMenuKeyboard() });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "admin_stats" && isAdmin) {
      const total = await queryFirst<{ c: number }>(env.DB, "SELECT COUNT(*) as c FROM orders");
      const pending = await queryFirst<{ c: number }>(env.DB, "SELECT COUNT(*) as c FROM orders WHERE status = 'pending_approval'");
      const completed = await queryFirst<{ c: number }>(env.DB, "SELECT COUNT(*) as c FROM orders WHERE status = 'completed'");
      const revenue = await queryFirst<{ s: number }>(env.DB, "SELECT COALESCE(SUM(price_toman), 0) as s FROM orders WHERE status = 'completed'");
      const text =
        "📊 <b>آمار فروش</b>\n\n" +
        "کل سفارش‌ها: <b>" + (total?.c ?? 0) + "</b>\n" +
        "در انتظار تایید: <b>" + (pending?.c ?? 0) + "</b>\n" +
        "تایید شده: <b>" + (completed?.c ?? 0) + "</b>\n" +
        "درآمد کل: <b>" + formatPrice(revenue?.s ?? 0) + "</b>";
      await bot.editMessageText(chatId, messageId, text, { reply_markup: adminMenuKeyboard() });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "trial_free") {
      // Check if already claimed
      const existing = await queryFirst<{ telegram_id: string; xray_sub_token: string }>(
        env.DB,
        "SELECT telegram_id, xray_sub_token FROM trial_claims WHERE telegram_id = ? LIMIT 1",
        String(from.id)
      );

      if (existing) {
        const subUrl = existing.xray_sub_token
          ? "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + existing.xray_sub_token
          : "";
        const text =
          "🎁 <b>شما قبلاً تست رایگان گرفته‌اید</b>\n\n" +
          (subUrl
            ? "🔗 لینک اتصال:\n<code>" + subUrl + "</code>"
            : "");
        await bot.editMessageText(chatId, messageId, text, {
          reply_markup: backToMainKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }

      // Show confirmation
      const text =
        "🎁 <b>تست رایگان</b>\n\n" +
        "📊 حجم: 1 GB\n" +
        "📅 مدت: 1 روز\n" +
        "⚡ سرعت: 10 Mbps\n\n" +
        "⚠️ این تست فقط <b>یک بار</b> برای هر کاربر فعاله.\n\n" +
        "برای دریافت، دکمه زیر رو بزن:";

      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ دریافت تست", callback_data: "trial_claim" }],
            [{ text: "« بازگشت", callback_data: "back_main" }],
          ],
        },
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data === "trial_claim") {
      // Double-check
      const existing = await queryFirst<{ telegram_id: string }>(
        env.DB,
        "SELECT telegram_id FROM trial_claims WHERE telegram_id = ? LIMIT 1",
        String(from.id)
      );

      if (existing) {
        await bot.answerCallbackQuery(cb.id, "شما قبلاً تست گرفته‌اید", true);
        return;
      }

      try {
        // Create xray user
        const { NodeClient } = await import("../adapters/ai/node-client");
        const node = new NodeClient(env, "hetzner-nbg1-01");

        const uuidRes = await node.task<{ stdout: string }>("xray.uuid");
        if (!uuidRes.ok || !uuidRes.output) {
          throw new Error("uuid failed");
        }
        const uuid = uuidRes.output.stdout.trim();

        const trialUserName = "trial" + from.id + "_" + Math.random().toString(36).slice(2, 6);
        const id = "xu_" + Math.random().toString(36).slice(2, 14);
        const publicToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const emailTag = trialUserName + "@raymond";
        const now = Date.now();
        const expiresAt = now + 86400000; // 1 day

        await run(
          env.DB,
          "INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token, max_connections) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?)",
          id, trialUserName, uuid, emailTag, 1, 10, now, now, expiresAt, 1, publicToken, 1
        );

        // Sync to all nodes
        const users = await queryAll<{ name: string; uuid: string }>(
          env.DB,
          "SELECT name, uuid FROM xray_users WHERE enabled = 1 ORDER BY created_at ASC"
        );
        const usersData = users.map((u) => ({
          name: u.name, uuid: u.uuid, enabled: true, created_at: Date.now(),
        }));
        const json = JSON.stringify(usersData, null, 2);
        const b64 = btoa(unescape(encodeURIComponent(json)));
        const script = "echo '" + b64 + "' | base64 -d | sudo tee /usr/local/etc/xray/users.json > /dev/null && sudo chown raymond:raymond /usr/local/etc/xray/users.json && bash ~/raymond-node/scripts/xray-sync.sh && sudo systemctl restart xray && echo SYNC_DONE";

        const nodes = await queryAll<{ id: string }>(
          env.DB,
          "SELECT id FROM nodes WHERE enabled = 1"
        );
        await Promise.all(nodes.map(async (n) => {
          try {
            const cli = new NodeClient(env, n.id);
            await cli.task("shell.exec", { cmd: script }, 60000);
          } catch (e) {
            console.error("trial sync to " + n.id + " failed:", e);
          }
        }));

        // Save trial claim
        await run(
          env.DB,
          "INSERT INTO trial_claims (telegram_id, xray_user_name, xray_sub_token, claimed_at) VALUES (?, ?, ?, ?)",
          String(from.id), trialUserName, publicToken, now
        );

        const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + publicToken;
        const successText =
          "🎉 <b>تست رایگان فعال شد!</b>\n\n" +
          "📊 حجم: 1 GB\n" +
          "📅 مدت: 1 روز\n" +
          "⚡ سرعت: 10 Mbps\n\n" +
          "🔗 <b>لینک اتصال:</b>\n" +
          "<code>" + subUrl + "</code>\n\n" +
          "📱 این لینک رو توی V2Box یا Hiddify import کن.";

        await bot.editMessageText(chatId, messageId, successText, {
          reply_markup: backToMainKeyboard(),
        });

        // Send QR
        const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" + encodeURIComponent(subUrl);
        await bot.sendPhoto(chatId, qrUrl, {
          caption: "📷 QR تست رایگان",
        });

        await bot.answerCallbackQuery(cb.id, "تست فعال شد ✅");
        return;
      } catch (e) {
        console.error("trial creation failed:", e);
        await bot.answerCallbackQuery(cb.id, "خطا در ساخت تست", true);
        return;
      }
    }

    if (data.startsWith("renew_")) {
      const orderId = data.slice("renew_".length);
      const order = await queryFirst<{
        id: string;
        xray_user_name: string;
        product_name: string;
        status: string;
      }>(
        env.DB,
        "SELECT id, xray_user_name, product_name, status FROM orders WHERE id = ? AND user_telegram_id = ? LIMIT 1",
        orderId,
        String(from.id)
      );
      if (!order || !order.xray_user_name || order.status !== "completed") {
        await bot.answerCallbackQuery(cb.id, "اکانت قابل تمدید نیست", true);
        return;
      }

      // Save pending renew intent
      await setUserState(env, String(from.id), "renew_pending", { target_order_id: orderId, target_user_name: order.xray_user_name });

      // Show plans
      const products = await queryAll<{
        id: string;
        name: string;
        quota_gb: number;
        duration_days: number;
        price_toman: number;
      }>(
        env.DB,
        "SELECT id, name, quota_gb, duration_days, price_toman FROM products WHERE enabled = 1 ORDER BY sort_order ASC"
      );

      if (products.length === 0) {
        await bot.editMessageText(chatId, messageId, "❌ فعلاً پلنی موجود نیست.", {
          reply_markup: backToMainKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }

      const rows = products.map((p) => [{
        text: p.name + " — " + p.quota_gb + "GB / " + p.duration_days + " روز — " + formatPrice(p.price_toman),
        callback_data: "renew_plan_" + p.id,
      }]);
      rows.push([{ text: "« بازگشت", callback_data: "my_accounts" }]);

      await bot.editMessageText(
        chatId,
        messageId,
        "🔄 <b>تمدید اکانت</b>\n\nاکانت: <code>" + order.xray_user_name + "</code>\n\nپلن مورد نظر رو انتخاب کن:",
        { reply_markup: { inline_keyboard: rows } }
      );
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("renew_plan_")) {
      const productId = data.slice("renew_plan_".length);
      const state = await getUserState(env, String(from.id));
      if (!state || state.state !== "renew_pending") {
        await bot.answerCallbackQuery(cb.id, "جلسه منقضی شده", true);
        return;
      }

      const targetOrderId = state.state_data.target_order_id as string;
      const targetUserName = state.state_data.target_user_name as string;

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
        await bot.answerCallbackQuery(cb.id, "پلن پیدا نشد", true);
        return;
      }

      // Update state to awaiting_receipt with renew info
      await setUserState(env, String(from.id), "awaiting_receipt", {
        product_id: product.id,
        product_name: product.name,
        order_type: "renew",
        target_user_name: targetUserName,
        target_order_id: targetOrderId,
      });

      const text =
        "💳 <b>پرداخت برای تمدید</b>\n\n" +
        "📦 پلن: " + escapeHtml(product.name) + "\n" +
        "💰 مبلغ: <b>" + formatPrice(product.price_toman) + "</b>\n\n" +
        "💳 <b>" + settings.payment_card + "</b>\n" +
        "👤 به نام: <b>" + settings.payment_holder + "</b>\n\n" +
        "بعد از واریز، <b>عکس فیش</b> رو همین‌جا بفرست 📷";

      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: cancelKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("page_")) {
      const orderId = data.slice("page_".length);
      const order = await queryFirst<{
        id: string;
        product_name: string;
        xray_sub_token: string;
      }>(
        env.DB,
        "SELECT id, product_name, xray_sub_token FROM orders WHERE id = ? AND user_telegram_id = ? LIMIT 1",
        orderId,
        String(from.id)
      );
      if (!order || !order.xray_sub_token) {
        await bot.answerCallbackQuery(cb.id, "اکانت پیدا نشد", true);
        return;
      }

      const pageUrl = "https://raymond.myraymond2025.workers.dev/u/" + order.xray_sub_token;

      const text =
        "📱 <b>صفحه اکانت شما</b>\n\n" +
        "📦 " + escapeHtml(order.product_name) + "\n\n" +
        "🔗 " + pageUrl + "\n\n" +
        "👆 این لینک رو باز کن تا:\n" +
        "• مصرف و باقی‌مانده رو ببینی\n" +
        "• روزهای باقی‌مانده رو چک کنی\n" +
        "• QR و لینک اتصال رو بگیری";

      await bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔓 باز کردن صفحه", url: pageUrl }],
            [{ text: "« بازگشت", callback_data: "my_accounts" }],
          ],
        },
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    if (data.startsWith("qr_")) {
      const orderId = data.slice("qr_".length);
      const order = await queryFirst<{
        id: string;
        product_name: string;
        xray_sub_token: string;
      }>(
        env.DB,
        "SELECT id, product_name, xray_sub_token FROM orders WHERE id = ? AND user_telegram_id = ? LIMIT 1",
        orderId,
        String(from.id)
      );
      if (!order || !order.xray_sub_token) {
        await bot.answerCallbackQuery(cb.id, "اکانت پیدا نشد", true);
        return;
      }

      const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + order.xray_sub_token;
      const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" + encodeURIComponent(subUrl);

      const caption =
        "📷 QR اکانت" + "\n\n" +
        "📦 " + escapeHtml(order.product_name) + "\n\n" +
        "📱 این QR رو با V2Box یا Hiddify اسکن کن.";

      await bot.sendPhoto(chatId, qrUrl, {
        caption,
        reply_markup: backToMainKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    await bot.answerCallbackQuery(cb.id);
  } catch (err) {
    console.error("handleCallback error:", err);
    try {
      await bot.answerCallbackQuery(cb.id, "خطا: " + String(err).slice(0, 180), true);
    } catch {}
  }
}

async function handleReceiptPhoto(
  env: Env,
  bot: TelegramBot,
  msg: NonNullable<TelegramUpdate["message"]>,
  adminId: string
): Promise<void> {
  const from = msg.from;
  const state = await getUserState(env, String(from.id));
  if (!state || state.state !== "awaiting_receipt") {
    await bot.sendMessage(msg.chat.id, "⚠️ اول یه پلن انتخاب کن و فیش رو از اون مسیر بفرست.\n/start", { reply_markup: backToMainKeyboard() });
    return;
  }
  const productId = state.state_data.product_id as string;
  const product = await queryFirst<{ id: string; name: string; quota_gb: number; speed_mbps: number; duration_days: number; price_toman: number }>(
    env.DB,
    "SELECT id, name, quota_gb, speed_mbps, duration_days, price_toman FROM products WHERE id = ? LIMIT 1",
    productId
  );
  if (!product) {
    await bot.sendMessage(msg.chat.id, "❌ محصول پیدا نشد، دوباره شروع کن.");
    await setUserState(env, String(from.id), "idle");
    return;
  }
  const orderId = newId("ord");
  const now = Date.now();
  const photo = msg.photo![msg.photo!.length - 1];
  await run(
    env.DB,
    "INSERT INTO orders (id, user_telegram_id, user_username, user_first_name, product_id, product_name, product_snapshot, price_toman, status, receipt_file_id, receipt_chat_id, receipt_message_id, created_at, updated_at, order_type, target_user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?, ?, ?, ?)",
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
    now,
    (state.state_data.order_type as string) || "new",
    (state.state_data.target_user_name as string) || null
  );
  await bot.sendMessage(msg.chat.id, "✅ فیش شما دریافت شد!\n\n⏳ در انتظار تایید ادمین...\n\nبعد از تایید، لینک اتصال برات ارسال می‌شه.", { reply_markup: backToMainKeyboard() });
  const adminText =
    "🔔 <b>سفارش جدید</b>\n\n" +
    "👤 کاربر: " + escapeHtml(from.first_name) + (from.username ? " (@" + from.username + ")" : "") + "\n" +
    "🆔 Telegram ID: <code>" + from.id + "</code>\n\n" +
    "📦 محصول: <b>" + escapeHtml(product.name) + "</b>\n" +
    "📊 " + product.quota_gb + " GB / " + product.duration_days + " روز\n" +
    "💰 <b>" + formatPrice(product.price_toman) + "</b>\n\n" +
    "ID سفارش: <code>" + orderId + "</code>";
  try {
    await bot.copyMessage(adminId, msg.chat.id, msg.message_id, { caption: adminText, reply_markup: adminOrderKeyboard(orderId) });
  } catch (err) {
    console.error("copyMessage to admin failed:", err);
    await bot.sendMessage(adminId, adminText, { reply_markup: adminOrderKeyboard(orderId) });
  }
  await setUserState(env, String(from.id), "idle");
}

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
    order_type?: string;
    target_user_name?: string;
  }>(
    env.DB,
    "SELECT id, user_telegram_id, product_id, product_name, product_snapshot, status, order_type, target_user_name FROM orders WHERE id = ? LIMIT 1",
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

  const isRenew = order.order_type === "renew" && order.target_user_name;

  try {
    const { NodeClient } = await import("../adapters/ai/node-client");
    const nodes = await queryAll<{ id: string }>(
      env.DB,
      "SELECT id FROM nodes WHERE enabled = 1 ORDER BY sort_order ASC"
    );
    const firstNode = nodes[0]?.id ?? "hetzner-nbg1-01";
    const node = new NodeClient(env, firstNode);

    let xrayUserName: string;
    let publicToken: string;
    const now = Date.now();

    if (isRenew) {
      // ===== RENEW EXISTING USER =====
      xrayUserName = order.target_user_name!;
      const existing = await queryFirst<{
        id: string;
        public_token: string;
        quota_gb: number;
        duration_days: number;
        expires_at: number | null;
        speed_mbps: number;
      }>(
        env.DB,
        "SELECT id, public_token, quota_gb, duration_days, expires_at, speed_mbps FROM xray_users WHERE name = ? LIMIT 1",
        xrayUserName
      );

      if (!existing) {
        throw new Error("Target user not found: " + xrayUserName);
      }

      publicToken = existing.public_token;

      // Calculate new quota (add)
      const newQuota = existing.quota_gb + snapshot.quota_gb;

      // Calculate new duration
      const newDays = existing.duration_days + snapshot.duration_days;

      // Calculate new expires_at
      let newExpiresAt: number | null;
      if (snapshot.duration_days === 0) {
        newExpiresAt = null; // infinite
      } else {
        const baseTime = existing.expires_at && existing.expires_at > now
          ? existing.expires_at
          : now;
        newExpiresAt = baseTime + snapshot.duration_days * 86400000;
      }

      // Update user
      await run(
        env.DB,
        "UPDATE xray_users SET quota_gb = ?, duration_days = ?, expires_at = ?, speed_mbps = ?, enabled = 1, updated_at = ? WHERE name = ?",
        newQuota,
        newDays,
        newExpiresAt,
        snapshot.speed_mbps > 0 ? snapshot.speed_mbps : existing.speed_mbps,
        now,
        xrayUserName
      );
    } else {
      // ===== CREATE NEW USER =====
      const uuidRes = await node.task<{ stdout: string }>("xray.uuid");
      if (!uuidRes.ok || !uuidRes.output) {
        throw new Error("uuid generation failed: " + (uuidRes.error ?? "unknown"));
      }
      const uuid = uuidRes.output.stdout.trim();
      const id = "xu_" + randomHex(12);
      publicToken = randomHex(16);
      xrayUserName = "tg" + order.user_telegram_id + "_" + randomHex(3);
      const emailTag = xrayUserName + "@raymond";
      const expiresAt = snapshot.duration_days > 0 ? now + snapshot.duration_days * 86400000 : null;

      await run(
        env.DB,
        "INSERT INTO xray_users (id, name, uuid, email_tag, quota_gb, speed_mbps, used_bytes, enabled, created_at, updated_at, expires_at, duration_days, public_token) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?)",
        id, xrayUserName, uuid, emailTag, snapshot.quota_gb, snapshot.speed_mbps, now, now, expiresAt, snapshot.duration_days, publicToken
      );
    }

    // Sync all users to all nodes
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

    await Promise.all(
      nodes.map(async (n) => {
        try {
          const cli = new NodeClient(env, n.id);
          await cli.task("shell.exec", { cmd: script }, 60000);
        } catch (e) {
          console.error("sync to " + n.id + " failed:", e);
        }
      })
    );

    // Update order
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

    // Notify user
    const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + publicToken;
    const header = isRenew ? "🔄 <b>تمدید انجام شد!</b>" : "🎉 <b>پرداخت شما تایید شد!</b>";
    const userText =
      header + "\n\n" +
      "📦 " + escapeHtml(order.product_name) + "\n" +
      (isRenew
        ? "✅ به اکانت <code>" + xrayUserName + "</code> اضافه شد\n\n"
        : "📊 " + snapshot.quota_gb + " GB / " + snapshot.duration_days + " روز\n\n") +
      "🔗 <b>لینک اتصال:</b>\n<code>" + subUrl + "</code>\n\n" +
      "📱 این لینک رو توی V2Box یا Hiddify import کن.";

    await bot.sendMessage(order.user_telegram_id, userText);

    await bot.editMessageCaption(
      adminChatId,
      adminMessageId,
      (isRenew ? "🔄 تمدید شد: " : "✅ تایید شد: ") + order.user_telegram_id + "\n📦 " + escapeHtml(order.product_name) + "\n🔑 " + xrayUserName,
      { reply_markup: adminMenuKeyboard() }
    );
  } catch (err) {
    console.error("approveOrder error:", err);
    try {
      await bot.editMessageCaption(
        adminChatId,
        adminMessageId,
        "❌ خطا: " + escapeHtml(String(err)).slice(0, 400),
        { reply_markup: adminMenuKeyboard() }
      );
    } catch {}
  }
}

async function rejectOrder(
  env: Env,
  bot: TelegramBot,
  orderId: string,
  adminChatId: number,
  adminMessageId: number
): Promise<void> {
  const order = await queryFirst<{ id: string; user_telegram_id: string; product_name: string; status: string }>(
    env.DB,
    "SELECT id, user_telegram_id, product_name, status FROM orders WHERE id = ? LIMIT 1",
    orderId
  );
  if (!order) {
    await bot.editMessageCaption(adminChatId, adminMessageId, "❌ سفارش پیدا نشد", { reply_markup: adminMenuKeyboard() });
    return;
  }
  await run(env.DB, "UPDATE orders SET status = 'rejected', updated_at = ? WHERE id = ?", Date.now(), orderId);
  await bot.sendMessage(
    order.user_telegram_id,
    "❌ <b>سفارش شما رد شد</b>\n\n📦 " + escapeHtml(order.product_name) + "\n\nبرای اطلاعات بیشتر با پشتیبانی تماس بگیرید."
  );
  await bot.editMessageCaption(adminChatId, adminMessageId, "❌ سفارش رد شد", { reply_markup: adminMenuKeyboard() });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// L() = Unicode-escape wrapper for Persian strings (avoids encoding issues)
function L(s: string): string {
  return s.replace(/[^\x00-\x7F]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code > 0xFFFF) {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xD800;
      const low = ((code - 0x10000) % 0x400) + 0xDC00;
      return "\\u" + high.toString(16).padStart(4, "0") + "\\u" + low.toString(16).padStart(4, "0");
    }
    return "\\u" + code.toString(16).padStart(4, "0");
  });
}

