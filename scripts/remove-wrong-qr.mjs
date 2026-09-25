import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");

// Remove the wrongly inserted QR handler (the one that's causing "Expected finally")
// Pattern: QR handler block right after "}" then "if (data === "help")"
const qrRegex = /if \(data\.startsWith\("qr_"\)\) \{[\s\S]*?\}\s*\n\s*\n\s*if \(data === "help"\)/;

if (qrRegex.test(c)) {
  c = c.replace(qrRegex, 'if (data === "help")');
  console.log("Wrong QR block removed");
}

// Check if QR handler still exists anywhere
if (c.includes('data.startsWith("qr_")')) {
  console.log("QR handler still somewhere - checking...");
  const count = (c.match(/data\.startsWith\("qr_"\)/g) || []).length;
  console.log("Count:", count);
} else {
  console.log("QR handler removed completely");
}

fs.writeFileSync(path, c, "utf-8");
