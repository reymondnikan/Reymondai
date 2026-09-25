import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// Find the approveOrder function body
const fnStart = c.indexOf("async function approveOrder(");
if (fnStart === -1) {
  console.log("approveOrder not found");
  process.exit(1);
}

// Find the end of the function - look for "async function rejectOrder"
const fnEnd = c.indexOf("async function rejectOrder", fnStart);
if (fnEnd === -1) {
  console.log("rejectOrder not found");
  process.exit(1);
}

const newApproveOrder = `async function approveOrder(
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
      header + "\\n\\n" +
      "📦 " + escapeHtml(order.product_name) + "\\n" +
      (isRenew
        ? "✅ به اکانت <code>" + xrayUserName + "</code> اضافه شد\\n\\n"
        : "📊 " + snapshot.quota_gb + " GB / " + snapshot.duration_days + " روز\\n\\n") +
      "🔗 <b>لینک اتصال:</b>\\n<code>" + subUrl + "</code>\\n\\n" +
      "📱 این لینک رو توی V2Box یا Hiddify import کن.";

    await bot.sendMessage(order.user_telegram_id, userText);

    await bot.editMessageCaption(
      adminChatId,
      adminMessageId,
      (isRenew ? "🔄 تمدید شد: " : "✅ تایید شد: ") + order.user_telegram_id + "\\n📦 " + escapeHtml(order.product_name) + "\\n🔑 " + xrayUserName,
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

`;

c = c.substring(0, fnStart) + newApproveOrder + c.substring(fnEnd);

fs.writeFileSync(path, c, "utf-8");
console.log("approveOrder rewritten with renew support");
