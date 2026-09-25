import fs from "node:fs";

const path = "src/worker/index.ts";
let c = fs.readFileSync(path, "utf-8");

if (!c.includes("nodesRoutes")) {
  // Add import
  c = c.replace(
    'import { shopRoutes } from "./routes/shop";',
    'import { shopRoutes } from "./routes/shop";\nimport { nodesRoutes } from "./routes/nodes";'
  );
  
  // Mount after /api/shop
  c = c.replace(
    'app.route("/api/shop", shopRoutes);',
    'app.route("/api/shop", shopRoutes);\napp.route("/api/nodes-list", nodesRoutes);'
  );
  
  fs.writeFileSync(path, c, "utf-8");
  console.log("index.ts updated");
} else {
  console.log("Already has nodesRoutes");
}
