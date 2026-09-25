import fs from "node:fs";

const path = "src/worker/bot/handler.ts";
let c = fs.readFileSync(path, "utf-8");
const lines = c.split("\n");

// پیدا کردن همه "const pageUrl" که "if (data === my_page)" قبلشون نیست
// این بلوک‌های یتیم رو حذف کن

const toRemove = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const pageUrl = "https://raymond.myraymond2025.workers.dev/u/"')) {
    // چک کن که آیا خط بالا‌ترش "if (data === my_page" هست
    let isOrphan = true;
    for (let j = Math.max(0, i - 15); j < i; j++) {
      if (lines[j] && lines[j].includes('if (data === "my_page")')) {
        isOrphan = false;
        break;
      }
    }
    
    if (isOrphan) {
      // این بلوک یتیمه — از خط i تا "return;\n    }"
      let endIdx = i;
      for (let k = i; k < Math.min(i + 40, lines.length); k++) {
        if (lines[k] && lines[k].trim() === "}" && lines[k - 1] && lines[k - 1].trim() === "return;") {
          endIdx = k;
          break;
        }
      }
      toRemove.push({ start: i, end: endIdx });
      console.log("Found orphan at lines " + (i + 1) + " to " + (endIdx + 1));
    }
  }
}

// حذف از آخر به اول (تا indexها تغییر نکنن)
toRemove.sort((a, b) => b.start - a.start);
for (const r of toRemove) {
  lines.splice(r.start, r.end - r.start + 1);
}

fs.writeFileSync(path, lines.join("\n"), "utf-8");
console.log("Removed " + toRemove.length + " orphan block(s)");
