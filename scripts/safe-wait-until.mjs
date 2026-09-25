import fs from "node:fs";
import path from "node:path";

// Files to process
const files = [
  "src/worker/routes/xray.ts",
  "src/worker/routes/shop.ts",
  "src/worker/routes/bot-buttons.ts",
  "src/worker/routes/nodes-crud.ts",
  "src/worker/bot/handler.ts",
  "src/worker/index.ts",
];

let totalChanges = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log("skip:", file);
    continue;
  }

  let c = fs.readFileSync(file, "utf-8");
  const before = c;

  // Replace "c.executionCtx.waitUntil(" with safe version
  // Match "c.executionCtx.waitUntil(" and replace with "safeWaitUntil(c,"
  c = c.replace(/c\.executionCtx\.waitUntil\(/g, "safeWaitUntil(c, ");

  if (c !== before) {
    // Add helper function at end of file (or after imports)
    const helper = `

// Safe waitUntil wrapper — handles cases where executionCtx is undefined (e.g. DO fetch)
function safeWaitUntil(c: { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } }, promise: Promise<unknown>): void {
  const ctx = c?.executionCtx;
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(promise);
  } else {
    // Fallback: run the promise without awaiting
    promise.catch((err) => console.error("bg task failed:", err));
  }
}
`;

    // Only add if not already there
    if (!c.includes("function safeWaitUntil")) {
      // Insert after the last import statement
      const importEnd = c.lastIndexOf('\nimport ');
      const nextNewline = c.indexOf('\n', importEnd + 1);
      if (nextNewline !== -1) {
        c = c.substring(0, nextNewline + 1) + helper + c.substring(nextNewline + 1);
      } else {
        c = helper + c;
      }
    }

    fs.writeFileSync(file, c, "utf-8");
    console.log("updated:", file);
    totalChanges++;
  }
}

console.log(`\nTotal files changed: ${totalChanges}`);
