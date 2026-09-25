import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
const lines = fs.readFileSync(path, "utf-8").split("\n");

// Look at lines 310-340
for (let i = 310; i < 345 && i < lines.length; i++) {
  console.log((i + 1) + ": " + lines[i]);
}
