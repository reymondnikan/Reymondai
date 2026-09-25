import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// حذف handler قدیمی page_
c = c.replace(/if \(data\.startsWith\("page_"\)\) \{[\s\S]*?\n\s*\}\n\s*\n\s*/g, "");

// پیدا کردن محل QR handler
const qrIdx = c.indexOf('if (data.startsWith("qr_")');
if (qrIdx === -1) {
  console.log("QR handler not found");
  process.exit(1);
}

const newHandler = `if (data === "my_page") {
      // از endpoint /user-page/:telegramId استفاده کن
      const { NodeClient } = await import("../adapters/ai/node-client");
      // مستقیم از D1 استفاده کنیم — ساده‌تره
      const telegramId = String(from.id);

      // چک کن user_page token داره یا نه
      let page = await queryFirst<{ token: string }>(
        env.DB,
        "SELECT token FROM user_pages WHERE telegram_id = ? LIMIT 1",
        telegramId
      );

      if (!page) {
        // بساز
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        await run(
          env.DB,
          "INSERT INTO user_pages (token, telegram_id, created_at) VALUES (?, ?, ?)",
          token,
          telegramId,
          Date.now()
        );
        page = { token };
      }

      const pageUrl = "https://raymond.myraymond2025.workers.dev/u/" + page.token;

      const text =
        "📱 <b>پنل اکانت‌های شما</b>\\n\\n" +
        "🔗 " + pageUrl + "\\n\\n" +
        "👆 این لینک رو باز کن تا:\\n" +
        "• همه‌ی اکانت‌هات رو یه جا ببینی\\n" +
        "• مصرف و باقی‌مانده هر کدوم رو ببینی\\n" +
        "• روزهای باقی‌مانده رو چک کنی\\n" +
        "• QR و لینک اتصال هر اکانت رو بگیری";

      await bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔓 باز کردن پنل اکانت‌ها", url: pageUrl }],
            [{ text: "« بازگشت", callback_data: "back_main" }],
          ],
        },
      });
      await bot.answerCallbackQuery(cb.id);
      return;
    }

    `;

c = c.substring(0, qrIdx) + newHandler + c.substring(qrIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("my_page handler added");
