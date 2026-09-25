import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
const lines = fs.readFileSync(path, "utf-8").split("\n");

// پاک کردن خطوط 264-285 (index 263 تا 284)
// این تکه‌ی یتیمه که از "const pageUrl" شروع می‌شه و به "return;\n    }" ختم می‌شه

// اول verify کنیم
console.log("Line 264 (index 263):", lines[263]);
console.log("Line 285 (index 284):", lines[284]);

if (!lines[263].includes("const pageUrl = \"https://raymond")) {
  console.log("ERROR: line 264 is not what we expect");
  process.exit(1);
}

if (!lines[284].includes("}")) {
  console.log("ERROR: line 285 is not what we expect");
  process.exit(1);
}

// پاک کن
lines.splice(263, 22); // حذف 22 خط

fs.writeFileSync(path, lines.join("\n"), "utf-8");
console.log("Removed orphan block");
