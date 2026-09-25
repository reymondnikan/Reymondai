// Inline keyboards for the shop bot.

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export function mainMenuKeyboard(isAdmin: boolean): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows: InlineKeyboardButton[][] = [
    [{ text: "🛒 خرید اکانت", callback_data: "buy" }],
    [{ text: "📦 اکانت‌های من", callback_data: "my_accounts" }],
    [{ text: "❓ راهنما", callback_data: "help" }],
    [{ text: "💬 پشتیبانی", callback_data: "support" }],
  ];
  if (isAdmin) {
    rows.push([{ text: "🔧 پنل ادمین", callback_data: "admin_panel" }]);
  }
  return { inline_keyboard: rows };
}

export function productsKeyboard(
  products: Array<{ id: string; name: string; price_toman: number; quota_gb: number; duration_days: number }>
): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows: InlineKeyboardButton[][] = products.map((p) => [
    {
      text: `${p.name} — ${p.quota_gb}GB / ${p.duration_days} روز — ${formatPrice(p.price_toman)}`,
      callback_data: `product_${p.id}`,
    },
  ]);
  rows.push([{ text: "« بازگشت", callback_data: "back_main" }]);
  return { inline_keyboard: rows };
}

export function productDetailKeyboard(productId: string): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [{ text: "✅ انتخاب و پرداخت", callback_data: `confirm_${productId}` }],
      [{ text: "« بازگشت", callback_data: "buy" }],
    ],
  };
}

export function backToMainKeyboard(): { inline_keyboard: InlineKeyboardButton[][] } {
  return { inline_keyboard: [[{ text: "« بازگشت", callback_data: "back_main" }]] };
}

export function cancelKeyboard(): { inline_keyboard: InlineKeyboardButton[][] } {
  return { inline_keyboard: [[{ text: "« لغو", callback_data: "back_main" }]] };
}

export function adminOrderKeyboard(orderId: string): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: "✅ تایید", callback_data: `approve_${orderId}` },
        { text: "❌ رد", callback_data: `reject_${orderId}` },
      ],
    ],
  };
}

export function adminMenuKeyboard(): { inline_keyboard: InlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [{ text: "📋 سفارش‌های در انتظار", callback_data: "admin_pending" }],
      [{ text: "📊 آمار", callback_data: "admin_stats" }],
      [{ text: "« بازگشت", callback_data: "back_main" }],
    ],
  };
}

export function formatPrice(toman: number): string {
  return toman.toLocaleString("fa-IR") + " تومان";
}
