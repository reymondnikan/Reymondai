import fs from "node:fs";

const path = "src/worker/bot/keyboards.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("myAccountsKeyboard") && c.includes("renew_")) {
  console.log("Already has renew button");
  process.exit(0);
}

// Find the myAccountsKeyboard function and replace it
const oldFn = /export function myAccountsKeyboard\([\s\S]*?\n\}/;

const newFn = `export function myAccountsKeyboard(
  orders: Array<{ id: string; xray_sub_token: string | null; status: string; product_name: string }>
): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows: InlineKeyboardButton[][] = [];

  for (const o of orders) {
    if (o.status === "completed") {
      // QR + Renew buttons for each completed order
      const buttons: InlineKeyboardButton[] = [];
      if (o.xray_sub_token) {
        buttons.push({ text: "📷 QR", callback_data: "qr_" + o.id });
      }
      buttons.push({ text: "🔄 تمدید " + o.product_name, callback_data: "renew_" + o.id });
      rows.push(buttons);
    }
  }

  rows.push([{ text: "« بازگشت", callback_data: "back_main" }]);
  return { inline_keyboard: rows };
}`;

if (oldFn.test(c)) {
  c = c.replace(oldFn, newFn);
  fs.writeFileSync(path, c, "utf-8");
  console.log("myAccountsKeyboard updated");
} else {
  console.log("myAccountsKeyboard not found");
}
