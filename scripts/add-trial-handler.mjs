import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes('data === "trial_free"')) {
  console.log("Already has trial handler");
  process.exit(0);
}

// Insert trial handler before the QR handler
const insertIdx = c.indexOf('if (data.startsWith("qr_")');
if (insertIdx === -1) {
  console.log("QR handler not found");
  process.exit(1);
}

const trialHandler = `if (data === "trial_free") {
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
          "🎁 <b>شما قبلاً تست رایگان گرفته‌اید</b>\\n\\n" +
          (subUrl
            ? "🔗 لینک اتصال:\\n<code>" + subUrl + "</code>"
            : "");
        await bot.editMessageText(chatId, messageId, text, {
          reply_markup: backToMainKeyboard(),
        });
        await bot.answerCallbackQuery(cb.id);
        return;
      }

      // Show confirmation
      const text =
        "🎁 <b>تست رایگان</b>\\n\\n" +
        "📊 حجم: 1 GB\\n" +
        "📅 مدت: 1 روز\\n" +
        "⚡ سرعت: 10 Mbps\\n\\n" +
        "⚠️ این تست فقط <b>یک بار</b> برای هر کاربر فعاله.\\n\\n" +
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
          "🎉 <b>تست رایگان فعال شد!</b>\\n\\n" +
          "📊 حجم: 1 GB\\n" +
          "📅 مدت: 1 روز\\n" +
          "⚡ سرعت: 10 Mbps\\n\\n" +
          "🔗 <b>لینک اتصال:</b>\\n" +
          "<code>" + subUrl + "</code>\\n\\n" +
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

    `;

c = c.substring(0, insertIdx) + trialHandler + c.substring(insertIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("Trial handler added");
