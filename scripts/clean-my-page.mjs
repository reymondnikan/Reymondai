import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// حذف همه my_page handlerها
let count = 0;
while (c.match(/if \(data === "my_page"\) \{[\s\S]*?\n\s*\}\n\s*\n\s*/)) {
  c = c.replace(/if \(data === "my_page"\) \{[\s\S]*?\n\s*\}\n\s*\n\s*/g, "");
  count++;
  if (count > 5) break; // safety
}

console.log("Removed", count, "copies");

// حالا یکی تازه اضافه کن قبل از my_accounts
const accIdx = c.indexOf('if (data === "my_accounts")');
if (accIdx === -1) {
  console.log("my_accounts not found");
  process.exit(1);
}

const newHandler = `if (data === "my_page") {
      const telegramId = String(from.id);

      let page = await queryFirst<{ token: string }>(
        env.DB,
        "SELECT token FROM user_pages WHERE telegram_id = ? LIMIT 1",
        telegramId
      );

      if (!page) {
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

c = c.substring(0, accIdx) + newHandler + c.substring(accIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("Done");
