// Updated keyboards: load custom buttons dynamically.

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface CustomButton {
  id: string;
  label: string;
  action_type: "text" | "url" | "callback";
  action_value: string;
  visible_to: "all" | "admins" | "users";
}

export function mainMenuKeyboard(
  isAdmin: boolean,
  customButtons: CustomButton[] = []
): { inline_keyboard: InlineKeyboardButton[][] } {
  const rows: InlineKeyboardButton[][] = [
    [{ text: "🛒 خرید اکانت", callback_data: "buy" }],
    [{ text: "📦 اکانت‌های من", callback_data: "my_accounts" }],
    [{ text: "❓ راهنما", callback_data: "help" }],
    [{ text: "💬 پشتیبانی", callback_data: "support" }],
  ];

  // Add custom buttons
  for (const btn of customButtons) {
    if (!btn.enabled || btn.visible_to === undefined) continue;
    if (btn.visible_to === "admins" && !isAdmin) continue;
    if (btn.visible_to === "users" && isAdmin) continue;

    if (btn.action_type === "url") {
      rows.push([{ text: btn.label, url: btn.action_value }]);
    } else if (btn.action_type === "callback") {
      rows.push([{ text: btn.label, callback_data: "custom_" + btn.id }]);
    } else {
      // text — show a popup with the text
      rows.push([{ text: btn.label, callback_data: "custom_text_" + btn.id }]);
    }
  }

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
