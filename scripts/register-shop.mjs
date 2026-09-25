import fs from "node:fs";

const path = "src/ui/apps/register.ts";
let c = fs.readFileSync(path, "utf-8");

if (!c.includes("ShopApp")) {
  // Add import
  c = c.replace(
    'import { XrayApp } from "./xray/XrayApp";',
    'import { XrayApp } from "./xray/XrayApp";\nimport { ShopApp } from "./shop/ShopApp";'
  );

  // Add registration before closing brace of registerApps
  const shopReg = `
  appRegistry.register({
    id: "shop",
    name: "فروش",
    icon: "\\u{1F6D2}",
    description: "Shop management",
    component: ShopApp,
    order: 30,
  });
`;
  // Insert after messenger registration
  c = c.replace(
    /(appRegistry\.register\(\{\s*id: "messenger",[\s\S]*?\}\);)/,
    "$1" + shopReg
  );

  fs.writeFileSync(path, c, "utf-8");
  console.log("register.ts updated");
} else {
  console.log("Already has ShopApp");
}
