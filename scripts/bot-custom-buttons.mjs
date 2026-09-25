import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// 1. Add helper to load custom buttons
if (!c.includes("loadCustomButtons")) {
  const helperCode = `
async function loadCustomButtons(env: Env): Promise<Array<{ id: string; label: string; action_type: string; action_value: string; visible_to: string; enabled: number }>> {
  try {
    const rows = await queryAll(
      env.DB,
      "SELECT id, label, action_type, action_value, visible_to, enabled FROM bot_buttons WHERE enabled = 1 ORDER BY sort_order ASC, created_at ASC"
    );
    return rows as Array<{ id: string; label: string; action_type: string; action_value: string; visible_to: string; enabled: number }>;
  } catch {
    return [];
  }
}
`;
  // Insert before the getSettings function
  const getSettingsIdx = c.indexOf("async function getSettings");
  if (getSettingsIdx !== -1) {
    c = c.substring(0, getSettingsIdx) + helperCode + "\n" + c.substring(getSettingsIdx);
  }
}

// 2. Update the main menu calls to include custom buttons
c = c.replace(
  /reply_markup: mainMenuKeyboard\(isAdmin\),/g,
  'reply_markup: mainMenuKeyboard(isAdmin, await loadCustomButtons(env)),'
);

// 3. Add handler for custom button callback
if (!c.includes('data.startsWith("custom_")')) {
  const customHandler = `
    // ===== Custom buttons =====
    if (data.startsWith("custom_")) {
      const btnId = data.replace(/^custom_(text_)?/, "");
      const btn = await queryFirst<{ label: string; action_type: string; action_value: string }>(
        env.DB,
        "SELECT label, action_type, action_value FROM bot_buttons WHERE id = ? LIMIT 1",
        btnId
      );
      if (!btn) {
        await bot.answerCallbackQuery(cb.id, ${L("دکمه پیدا نشد")}, true);
        return;
      }
      if (btn.action_type === "text") {
        await bot.answerCallbackQuery(cb.id, btn.action_value || btn.label, true);
      } else {
        await bot.answerCallbackQuery(cb.id);
      }
      return;
    }

`;
  // Insert before the final answerCallbackQuery at the end of handleCallback
  const fallbackIdx = c.indexOf("    await bot.answerCallbackQuery(cb.id);\n  } catch (err) {");
  if (fallbackIdx !== -1) {
    c = c.substring(0, fallbackIdx) + customHandler + c.substring(fallbackIdx);
  }
}

fs.writeFileSync(path, c, "utf-8");
console.log("handler.ts updated");
