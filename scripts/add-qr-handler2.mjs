import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes('data.startsWith("qr_")')) {
  console.log("QR handler already exists");
  process.exit(0);
}

// Find good insertion point — before the custom_ handler OR before the final catch
let insertIdx = c.indexOf('if (data.startsWith("custom_")');
if (insertIdx === -1) {
  // fallback: before "await bot.answerCallbackQuery(cb.id);\n  } catch (err)"
  insertIdx = c.lastIndexOf("await bot.answerCallbackQuery(cb.id);");
}

if (insertIdx === -1) {
  console.log("No insertion point found");
  process.exit(1);
}

const qrHandler = `if (data.startsWith("qr_")) {
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
        "📷 QR اکانت" + "\\n\\n" +
        "📦 " + escapeHtml(order.product_name) + "\\n\\n" +
        "📱 این QR رو با V2Box یا Hiddify اسکن کن.";

      await bot.sendPhoto(chatId, qrUrl, {
        caption,
        reply_markup: backToMainKeyboard(),
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    `;

c = c.substring(0, insertIdx) + qrHandler + c.substring(insertIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("QR handler added");
