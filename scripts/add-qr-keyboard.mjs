import fs from "node:fs";

const path = "src/worker/bot/keyboards.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("myAccountsKeyboard")) {
  console.log("Already has myAccountsKeyboard");
  process.exit(0);
}

// Add new keyboard function
const newFn = `

// ============================================================
// My Accounts keyboard — shows QR button + back
// ============================================================
export function myAccountsKeyboard(
  orders: Array<{ id: string; xray_sub_token: string | null; status: string }>
): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows: InlineKeyboardButton[][] = [];

  // One row per completed order with a token
  for (const o of orders) {
    if (o.status === "completed" && o.xray_sub_token) {
      rows.push([
        { text: "📷 QR اکانت", callback_data: "qr_" + o.id },
      ]);
    }
  }

  rows.push([{ text: "« بازگشت", callback_data: "back_main" }]);
  return { inline_keyboard: rows };
}
`;

// Insert before "export function formatPrice"
const insertIdx = c.indexOf("export function formatPrice");
if (insertIdx !== -1) {
  c = c.substring(0, insertIdx) + newFn + "\n" + c.substring(insertIdx);
}

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
