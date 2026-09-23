// App registration — imports every app and registers it.
// Add a new import + register() call to add a new tab.

import { appRegistry } from "../core/app-registry";
import { MessengerApp } from "./messenger/MessengerApp";
import { SettingsApp } from "./settings/SettingsApp";

export function registerApps(): void {
  appRegistry.register({
    id: "messenger",
    name: "Messenger",
    icon: "💬",
    description: "Telegram client",
    component: MessengerApp,
    order: 10,
  });

  appRegistry.register({
    id: "settings",
    name: "Settings",
    icon: "⚙",
    description: "Raymond settings",
    component: SettingsApp,
    order: 90,
  });
}
