// App registration — imports every app and registers it.

import { appRegistry } from "../core/app-registry";
import { MessengerApp } from "./messenger/MessengerApp";
import { SettingsApp } from "./settings/SettingsApp";
import { NodesApp } from "./nodes/NodesApp";
import { XrayApp } from "./xray/XrayApp";
import { ShopApp } from "./shop/ShopApp";

export function registerApps(): void {
  appRegistry.register({
    id: "messenger",
    name: "Messenger",
    icon: "\u{1F4AC}",
    description: "Telegram client",
    component: MessengerApp,
    order: 10,
  });
  appRegistry.register({
    id: "shop",
    name: "فروش",
    icon: "\u{1F6D2}",
    description: "Shop management",
    component: ShopApp,
    order: 30,
  });


  appRegistry.register({
    id: "xray",
    name: "Xray",
    icon: "\u{1F6E1}",
    description: "VLESS/Reality proxy control",
    component: XrayApp,
    order: 40,
  });

  appRegistry.register({
    id: "nodes",
    name: "Nodes",
    icon: "\u{1F5A5}",
    description: "VPS nodes management",
    component: NodesApp,
    order: 50,
  });

  appRegistry.register({
    id: "settings",
    name: "Settings",
    icon: "\u{2699}",
    description: "Raymond settings",
    component: SettingsApp,
    order: 90,
  });
}
