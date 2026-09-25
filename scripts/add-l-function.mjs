import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("function L(")) {
  console.log("L already defined");
  process.exit(0);
}

// Find good insertion point - after escapeHtml function
const escapeHtmlIdx = c.indexOf("function escapeHtml");
if (escapeHtmlIdx === -1) {
  console.log("escapeHtml not found");
  process.exit(1);
}

// Find the end of escapeHtml function
const escapeHtmlEnd = c.indexOf("}", escapeHtmlIdx) + 1;

const lFunction = `

// L() = Unicode-escape wrapper for Persian strings (avoids encoding issues)
function L(s: string): string {
  return s.replace(/[^\\x00-\\x7F]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code > 0xFFFF) {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xD800;
      const low = ((code - 0x10000) % 0x400) + 0xDC00;
      return "\\\\u" + high.toString(16).padStart(4, "0") + "\\\\u" + low.toString(16).padStart(4, "0");
    }
    return "\\\\u" + code.toString(16).padStart(4, "0");
  });
}
`;

c = c.substring(0, escapeHtmlEnd) + lFunction + c.substring(escapeHtmlEnd);

fs.writeFileSync(path, c, "utf-8");
console.log("L function added");
