import fs from "node:fs";

const path = "src/ui/apps/shop/api.ts";
let c = fs.readFileSync(path, "utf-8");

// Add BotButton interface if missing
if (!c.includes("BotButton")) {
  // Find the ShopSettings interface
  const settingsIdx = c.indexOf("export interface ShopSettings {");
  const settingsEnd = c.indexOf("}", settingsIdx) + 1;
  
  const botButtonInterface = `

export interface BotButton {
  id: string;
  label: string;
  action_type: "text" | "url" | "callback";
  visible_to: "all" | "admins" | "users";
  action_value: string;
  sort_order: number;
  enabled: boolean;
  created_at: number;
}`;
  
  c = c.substring(0, settingsEnd) + botButtonInterface + c.substring(settingsEnd);
}

// Add API methods
if (!c.includes("getBotButtons")) {
  // Find "getSettings:" line
  const getSettingsMatch = c.match(/(getSettings: \(\) =>[\s\S]*?\),)/);
  if (getSettingsMatch) {
    const newMethods = `${getSettingsMatch[1]}

  getBotButtons: () =>
    req<{ ok: boolean; buttons: BotButton[] }>("/bot-buttons"),
  createBotButton: (data: Partial<BotButton>) =>
    req<{ ok: boolean; id: string }>("/bot-buttons", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateBotButton: (id: string, data: Partial<BotButton>) =>
    req<{ ok: boolean }>("/bot-buttons/" + id, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteBotButton: (id: string) =>
    req<{ ok: boolean }>("/bot-buttons/" + id, {
      method: "DELETE",
    }),`;
    c = c.replace(getSettingsMatch[1], newMethods);
  }
}

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
