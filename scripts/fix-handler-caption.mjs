import fs from "node:fs";

let content = fs.readFileSync("src/worker/bot/handler.ts", "utf-8");

// Replace all editMessageText in approve/reject functions with editMessageCaption
// (only where chat is adminChatId and messageId is adminMessageId)

// Add helper function at end — replace the two function bodies
content = content.replace(
  /async function approveOrder\([\s\S]*?\n\}\n\nasync function rejectOrder/,
  `async function approveOrder(
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
      "🎉 <b>پرداخت شما تایید شد!</b>\\n\\n" +
      "📦 محصول: <b>" + escapeHtml(order.product_name) + "</b>\\n" +
      "📊 حجم: <b>" + snapshot.quota_gb + " GB</b>\\n" +
      "⚡ سرعت: <b>" + (snapshot.speed_mbps > 0 ? snapshot.speed_mbps + " Mbps" : "بی‌نهایت") + "</b>\\n" +
      "📅 مدت: <b>" + snapshot.duration_days + " روز</b>\\n\\n" +
      "🔗 <b>لینک اتصال:</b>\\n" +
      "<code>" + subUrl + "</code>\\n\\n" +
      "📱 این لینک رو توی V2Box یا Hiddify import کن.";

    await bot.sendMessage(order.user_telegram_id, userText);

    await bot.editMessageCaption(
      adminChatId,
      adminMessageId,
      "✅ <b>سفارش تایید شد</b>\\n\\n👤 " + order.user_telegram_id + "\\n📦 " + escapeHtml(order.product_name) + "\\n🔑 " + xrayUserName,
      { reply_markup: adminMenuKeyboard() }
    );
  } catch (err) {
    console.error("approveOrder error:", err);
    try {
      await bot.editMessageCaption(
        adminChatId,
        adminMessageId,
        "❌ <b>خطا در تایید</b>\\n\\n<code>" + escapeHtml(String(err)).slice(0, 400) + "</code>",
        { reply_markup: adminMenuKeyboard() }
      );
    } catch (e2) {
      console.error("editMessageCaption also failed:", e2);
    }
  }
}

async function rejectOrder`
);

content = content.replace(
  /async function rejectOrder\([\s\S]*?\n\}\n\nfunction escapeHtml/,
  `async function rejectOrder(
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
    "❌ <b>سفارش شما رد شد</b>\\n\\n📦 " + escapeHtml(order.product_name) + "\\n\\nبرای اطلاعات بیشتر با پشتیبانی تماس بگیرید."
  );

  await bot.editMessageCaption(adminChatId, adminMessageId, "❌ سفارش رد شد", {
    reply_markup: adminMenuKeyboard(),
  });
}

function escapeHtml`
);

fs.writeFileSync("src/worker/bot/handler.ts", content, "utf-8");
console.log("OK");
