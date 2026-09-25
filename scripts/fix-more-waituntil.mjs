import fs from "node:fs";

const files = [
  "src/worker/routes/bot-webhook.ts",
  "src/worker/routes/chat.ts",
];

const helper = `

// Safe waitUntil wrapper — handles cases where executionCtx is undefined
function safeWaitUntil(c: { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } }, promise: Promise<unknown>): void {
  const ctx = c?.executionCtx;
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(promise);
  } else {
    promise.catch((err) => console.error("bg task failed:", err));
  }
}
`;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log("skip:", file);
    continue;
  }

  let c = fs.readFileSync(file, "utf-8");
  const before = c;

  // Replace
  c = c.replace(/c\.executionCtx\.waitUntil\(/g, "safeWaitUntil(c, ");

  if (c !== before) {
    // Add helper if not there
    if (!c.includes("function safeWaitUntil")) {
      const lastImport = c.lastIndexOf("\nimport ");
      const nextNewline = c.indexOf("\n", lastImport + 1);
      if (nextNewline !== -1) {
        c = c.substring(0, nextNewline + 1) + helper + c.substring(nextNewline + 1);
      }
    }
    fs.writeFileSync(file, c, "utf-8");
    console.log("updated:", file);
  }
}
