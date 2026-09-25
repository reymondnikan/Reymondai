import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
const lines = fs.readFileSync(path, "utf-8").split("\n");

console.log("Lines 230-310:");
for (let i = 229; i < 310 && i < lines.length; i++) {
  console.log((i + 1) + ": " + lines[i]);
}
