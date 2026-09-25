import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// حذف page handler قدیمی اگه هست
c = c.replace(/if \(data\.startsWith\("page_"\)\) \{[\s\S]*?\n\s*\}\n\s*\n\s*/g, "");

// پیدا کردن محل QR handler
const qrIdx = c.indexOf('if (data.startsWith("qr_")');
if (qrIdx === -1) {
  console.log("QR handler not found");
  process.exit(1);
}

const pageHandler = `if (data.startsWith("page_")) {
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
        "📱 <b>صفحه اکانت شما</b>\\n\\n" +
        "📦 " + escapeHtml(order.product_name) + "\\n\\n" +
        "🔗 " + pageUrl + "\\n\\n" +
        "👆 این لینک رو باز کن تا:\\n" +
        "• مصرف و باقی‌مانده رو ببینی\\n" +
        "• روزهای باقی‌مانده رو چک کنی\\n" +
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

    `;

c = c.substring(0, qrIdx) + pageHandler + c.substring(qrIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
