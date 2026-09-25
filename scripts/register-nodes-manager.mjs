import fs from "node:fs";

const path = "src/ui/apps/register.ts";
let c = fs.readFileSync(path, "utf-8");

if (!c.includes("NodesManagerApp")) {
  c = c.replace(
    'import { ShopApp } from "./shop/ShopApp";',
    'import { ShopApp } from "./shop/ShopApp";\nimport { NodesManagerApp } from "./nodes-manager/NodesManagerApp";'
  );
  
  const reg = `
  appRegistry.register({
    id: "nodes-manager",
    name: "سرورها",
    icon: "\\u{1F310}",
    description: "Multi-node servers",
    component: NodesManagerApp,
    order: 35,
  });
`;
  // Add after shop registration
  c = c.replace(
    /(appRegistry\.register\(\{\s*id: "shop",[\s\S]*?\}\);)/,
    "$1" + reg
  );
  
  fs.writeFileSync(path, c, "utf-8");
  console.log("register.ts updated");
} else {
  console.log("Already has NodesManagerApp");
}
