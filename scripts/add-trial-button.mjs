import fs from "node:fs";

const path = "src/worker/bot/keyboards.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("trial_free")) {
  console.log("Already has trial button");
  process.exit(0);
}

// Add trial button to main menu
c = c.replace(
  /(\[\{ text: "🛒 خرید اکانت", callback_data: "buy" \}\],)/,
  `$1
    [{ text: "🎁 تست رایگان", callback_data: "trial_free" }],`
);

fs.writeFileSync(path, c, "utf-8");
console.log("Trial button added");
