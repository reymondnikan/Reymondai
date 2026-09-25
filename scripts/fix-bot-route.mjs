import fs from "node:fs";

const path = "src/worker/index.ts";
let c = fs.readFileSync(path, "utf-8");

// Check if import exists
if (!c.includes("botWebhookRoutes")) {
  // Add import after telegramWsRoutes
  c = c.replace(
    'import { telegramWsRoutes } from "./routes/telegram-ws";',
    'import { telegramWsRoutes } from "./routes/telegram-ws";\nimport { botWebhookRoutes } from "./routes/bot-webhook";'
  );
  console.log("Import added");
}

// Check if route is mounted
if (!c.includes('app.route("/api/bot"')) {
  // Mount BEFORE requireAuth — after "/node" route or after "/tg"
  if (c.includes('app.route("/tg", telegramWsRoutes);')) {
    c = c.replace(
      'app.route("/tg", telegramWsRoutes);',
      'app.route("/tg", telegramWsRoutes);\n\n// ===== Bot webhook (NO auth — Telegram calls it) =====\napp.route("/api/bot", botWebhookRoutes);'
    );
    console.log("Route mounted after /tg");
  }
}

fs.writeFileSync(path, c, "utf-8");
console.log("Done");
