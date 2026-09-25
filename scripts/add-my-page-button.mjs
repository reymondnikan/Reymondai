import fs from "node:fs";

const path = "src/worker/bot/keyboards.ts";
let c = fs.readFileSync(path, "utf-8");

// چک کن my_page هست یا نه
if (c.includes('"my_page"')) {
  console.log("Already has my_page in main menu");
  process.exit(0);
}

// اضافه کردن دکمه به main menu
c = c.replace(
  /(\[\{ text: "📦 اکانت‌های من", callback_data: "my_accounts" \}\],)/,
  `$1
    [{ text: "📱 پنل اکانت‌ها", callback_data: "my_page" }],`
);

fs.writeFileSync(path, c, "utf-8");
console.log("my_page button added");
