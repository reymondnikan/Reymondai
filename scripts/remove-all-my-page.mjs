import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// شمارش
const before = (c.match(/if \(data === "my_page"\)/g) || []).length;
console.log("Before: " + before + " copies");

// حذف همه my_page handlerها — این regex از "if (data" تا "return;\n    }" 
while (c.includes('if (data === "my_page")')) {
  const startIdx = c.indexOf('if (data === "my_page")');
  // پیدا کردن پایان: "return;\n    }"
  const returnIdx = c.indexOf("return;", startIdx);
  if (returnIdx === -1) {
    console.log("Cannot find return");
    break;
  }
  // بعد از return، اولین "}" رو پیدا کن
  const closeIdx = c.indexOf("}", returnIdx + 7);
  if (closeIdx === -1) {
    console.log("Cannot find close");
    break;
  }
  // حذف از startIdx تا closeIdx + 1
  // و فاصله بعدش رو هم پاک کن
  let endIdx = closeIdx + 1;
  while (endIdx < c.length && (c[endIdx] === "\n" || c[endIdx] === " " || c[endIdx] === "\r")) {
    endIdx++;
  }
  c = c.substring(0, startIdx) + c.substring(endIdx);
}

const after = (c.match(/if \(data === "my_page"\)/g) || []).length;
console.log("After: " + after + " copies");

// حالا یکی تازه اضافه کن
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

// اضافه کردن قبل از my_accounts
const accIdx = c.indexOf('if (data === "my_accounts")');
if (accIdx === -1) {
  console.log("my_accounts not found");
  process.exit(1);
}

c = c.substring(0, accIdx) + newHandler + c.substring(accIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("Done");
