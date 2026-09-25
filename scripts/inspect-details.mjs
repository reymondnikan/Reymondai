import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// Check if already added
if (c.includes("📱") && c.includes("max_connections")) {
  console.log("Already present");
  process.exit(0);
}

// Find the user details section (the one with Speed, Days)
// Look for the pattern with 📅 or روز مانده
const detailsRegex = /(<div className="xray-user-details">[\s\S]*?<\/div>)/;

const match = c.match(detailsRegex);
if (!match) {
  console.log("ERROR: details section not found");
  process.exit(1);
}

console.log("Found details section:");
console.log(match[1].substring(0, 300));

fs.writeFileSync("/tmp/details-section.txt", match[1], "utf-8");
