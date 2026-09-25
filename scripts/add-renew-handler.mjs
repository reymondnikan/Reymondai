import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes('data.startsWith("renew_")')) {
  console.log("Renew handler already exists");
  process.exit(0);
}

// Find insertion point before QR handler
const insertIdx = c.indexOf('if (data.startsWith("qr_")');
if (insertIdx === -1) {
  console.log("QR handler not found");
  process.exit(1);
}

const renewHandler = `if (data.startsWith("renew_")) {
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
        "🔄 <b>تمدید اکانت</b>\\n\\nاکانت: <code>" + order.xray_user_name + "</code>\\n\\nپلن مورد نظر رو انتخاب کن:",
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
        "💳 <b>پرداخت برای تمدید</b>\\n\\n" +
        "📦 پلن: " + escapeHtml(product.name) + "\\n" +
        "💰 مبلغ: <b>" + formatPrice(product.price_toman) + "</b>\\n\\n" +
        "💳 <b>" + settings.payment_card + "</b>\\n" +
        "👤 به نام: <b>" + settings.payment_holder + "</b>\\n\\n" +
        "بعد از واریز، <b>عکس فیش</b> رو همین‌جا بفرست 📷";

      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: cancelKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    `;

c = c.substring(0, insertIdx) + renewHandler + c.substring(insertIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("Renew handlers added");
