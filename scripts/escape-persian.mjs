import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let content = fs.readFileSync(path, "utf-8");

// Track changes
let count = 0;

// Replace Persian/Arabic chars inside string literals with unicode escapes
// This regex matches any Persian/Arabic char anywhere
content = content.replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g, (char) => {
  count++;
  const code = char.charCodeAt(0);
  return "\\u" + code.toString(16).padStart(4, "0");
});

console.log("Replaced", count, "Persian chars");

fs.writeFileSync(path, content, "utf-8");

// Verify
const verify = fs.readFileSync(path, "utf-8");
const remaining = (verify.match(/[\u0600-\u06FF]/g) || []).length;
console.log("Remaining Persian chars:", remaining);
