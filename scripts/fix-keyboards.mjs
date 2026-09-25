import fs from "node:fs";

const path = "src/worker/bot/keyboards.ts";
let c = fs.readFileSync(path, "utf-8");

// حذف myAccountsKeyboard قدیمی اگه هست
c = c.replace(/export function myAccountsKeyboard\([\s\S]*?\n\}\n?/g, "");

// اضافه کردن نسخه جدید قبل از formatPrice
const newFn = `export function myAccountsKeyboard(
  orders: Array<{ id: string; xray_sub_token: string | null; status: string; product_name: string }>
): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows: InlineKeyboardButton[][] = [];

  for (const o of orders) {
    if (o.status === "completed") {
      const buttons: InlineKeyboardButton[] = [];
      if (o.xray_sub_token) {
        buttons.push({ text: "📷 QR", callback_data: "qr_" + o.id });
        buttons.push({ text: "📱 صفحه", callback_data: "page_" + o.id });
      }
      buttons.push({ text: "🔄 تمدید", callback_data: "renew_" + o.id });
      rows.push(buttons);
    }
  }

  rows.push([{ text: "« بازگشت", callback_data: "back_main" }]);
  return { inline_keyboard: rows };
}

`;

const idx = c.indexOf("export function formatPrice");
if (idx === -1) {
  console.log("formatPrice not found");
  process.exit(1);
}

c = c.substring(0, idx) + newFn + c.substring(idx);

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
