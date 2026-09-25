import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// 1. Import myAccountsKeyboard
if (!c.includes("myAccountsKeyboard")) {
  c = c.replace(
    /(import \{[\s\S]*?formatPrice,\s*\n\} from "\.\/keyboards";)/,
    (m) => m.replace('formatPrice,\n}', 'formatPrice,\n  myAccountsKeyboard,\n}')
  );
}

// 2. Change my_accounts handler to use the new keyboard
// Find the "my_accounts" block
const accountsBlockRegex = /if \(data === "my_accounts"\) \{[\s\S]*?await bot\.answerCallbackQuery\(cb\.id\);\s*\n\s*return;\s*\n\s*\}/;

const newAccountsBlock = `if (data === "my_accounts") {
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

      let text = L("📦 اکانت‌های شما") + "\\n\\n";
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
        text += L("•") + " <b>" + escapeHtml(o.product_name) + "</b> — " + status + "\\n";
        if (o.xray_sub_token && o.status === "completed") {
          const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + o.xray_sub_token;
          text += "  " + L("🔗") + " <code>" + subUrl + "</code>\\n";
          completedOrders.push({ id: o.id, xray_sub_token: o.xray_sub_token, status: o.status });
        }
        text += "\\n";
      }
      
      await bot.editMessageText(chatId, messageId, text, {
        reply_markup: myAccountsKeyboard(completedOrders),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }`;

if (accountsBlockRegex.test(c)) {
  c = c.replace(accountsBlockRegex, newAccountsBlock);
  console.log("my_accounts updated");
} else {
  console.log("WARN: my_accounts block not found");
}

// 3. Add QR handler
if (!c.includes('data.startsWith("qr_")')) {
  const qrHandler = `
    // ===== QR Code =====
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
        await bot.answerCallbackQuery(cb.id, L("اکانت پیدا نشد"), true);
        return;
      }

      const subUrl = "https://raymond.myraymond2025.workers.dev/api/xray/sub/" + order.xray_sub_token;
      const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" + encodeURIComponent(subUrl);

      const caption =
        L("📷 QR اکانت") + "\\n\\n" +
        L("📦") + " " + escapeHtml(order.product_name) + "\\n\\n" +
        L("📱 این QR رو با V2Box یا Hiddify اسکن کن.");

      await bot.sendPhoto(chatId, qrUrl, {
        caption,
        reply_markup: backToMainKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

`;
  // Insert before the custom buttons handler
  const customIdx = c.indexOf('data.startsWith("custom_")');
  if (customIdx !== -1) {
    c = c.substring(0, customIdx) + qrHandler + "    " + c.substring(customIdx);
    console.log("QR handler added");
  }
}

fs.writeFileSync(path, c, "utf-8");
console.log("handler.ts updated");
