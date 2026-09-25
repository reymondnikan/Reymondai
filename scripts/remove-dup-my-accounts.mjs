import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
const c = fs.readFileSync(path, "utf-8");
const lines = c.split("\n");

// Find the duplicated "let text = 📦 اکانت‌های شما" section (around line 313, index 312)
// We'll remove the OLD version (lines 313-326 roughly)

// Find index of first "let text" for اکانت‌های شما (the OLD one, after the new block)
let oldStart = -1;
for (let i = 305; i < 320; i++) {
  if (lines[i] && lines[i].includes('let text = "📦 <b>اکانت‌های شما</b>')) {
    oldStart = i;
    break;
  }
}

if (oldStart === -1) {
  console.log("Old duplicate not found");
  process.exit(1);
}

console.log("Old section starts at line", oldStart + 1);

// Find the end of this old block: it should end with `    }` at the same indent level
// We're looking for "return;\n    }" pattern
let oldEnd = -1;
for (let i = oldStart; i < oldStart + 40; i++) {
  if (lines[i] && lines[i].trim() === "}" && i > oldStart + 5) {
    // This could be the closing brace of `if (data === "my_accounts")`
    // Check if the line before is "return;"
    if (lines[i - 1] && lines[i - 1].trim() === "return;") {
      oldEnd = i;
      break;
    }
  }
}

if (oldEnd === -1) {
  console.log("Old section end not found");
  process.exit(1);
}

console.log("Old section ends at line", oldEnd + 1);

// Remove lines oldStart to oldEnd
const newLines = [...lines.slice(0, oldStart), ...lines.slice(oldEnd + 1)];
fs.writeFileSync(path, newLines.join("\n"), "utf-8");
console.log("Duplicate removed");
