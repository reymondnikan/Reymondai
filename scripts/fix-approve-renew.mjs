import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// Find approveOrder function and check if it handles renew
if (c.includes("order.order_type") || c.includes("order_type ||")) {
  console.log("Already handles renew");
  process.exit(0);
}

// Find "const order = await queryFirst" in approveOrder
const orderSelectRegex = /(const order = await queryFirst<\{[\s\S]*?\}>\s*\(\s*env\.DB,\s*"SELECT [^"]+"[\s\S]*?orderId\s*\);)/;

const match = c.match(orderSelectRegex);
if (!match) {
  console.log("approveOrder SELECT not found");
  process.exit(1);
}

// Update the SELECT to include order_type and target_user_name
const newSelect = match[1]
  .replace('"SELECT id, user_telegram_id, product_id, product_name, product_snapshot, status FROM orders WHERE id = ? LIMIT 1"',
           '"SELECT id, user_telegram_id, product_id, product_name, product_snapshot, status, order_type, target_user_name FROM orders WHERE id = ? LIMIT 1"')
  .replace('id: string;\n    user_telegram_id: string;\n    product_id: string;\n    product_name: string;\n    product_snapshot: string;\n    status: string;',
           'id: string;\n    user_telegram_id: string;\n    product_id: string;\n    product_name: string;\n    product_snapshot: string;\n    status: string;\n    order_type?: string;\n    target_user_name?: string;');

c = c.replace(match[1], newSelect);

fs.writeFileSync(path, c, "utf-8");
console.log("approveOrder updated");
