import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// Find the handleReceiptPhoto function's INSERT INTO orders
const insertRegex = /(await run\(\s*env\.DB,\s*"INSERT INTO orders[\s\S]*?now,\s*now\s*\);)/;

const match = c.match(insertRegex);
if (!match) {
  console.log("INSERT INTO orders not found");
  process.exit(1);
}

// Replace the INSERT to include order_type and target_user_name
const newInsert = `await run(
    env.DB,
    "INSERT INTO orders (id, user_telegram_id, user_username, user_first_name, product_id, product_name, product_snapshot, price_toman, status, receipt_file_id, receipt_chat_id, receipt_message_id, created_at, updated_at, order_type, target_user_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?, ?, ?, ?)",
    orderId,
    String(from.id),
    from.username ?? null,
    from.first_name ?? null,
    product.id,
    product.name,
    JSON.stringify(product),
    product.price_toman,
    photo.file_id,
    String(msg.chat.id),
    String(msg.message_id),
    now,
    now,
    (state.state_data.order_type as string) || "new",
    (state.state_data.target_user_name as string) || null
  );`;

c = c.replace(insertRegex, newInsert);

fs.writeFileSync(path, c, "utf-8");
console.log("handleReceiptPhoto updated for renew");
