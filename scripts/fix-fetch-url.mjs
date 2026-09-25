import fs from "node:fs";

const path = "src/ui/apps/nodes/api.ts";
let c = fs.readFileSync(path, "utf-8");

// Replace the fetch line to skip BASE if path starts with /api/
const oldFetch = "const res = await fetch(`${BASE}${cleanPath}`, {";
const newFetch = 'const url = cleanPath.startsWith("/api/") ? cleanPath : BASE + cleanPath;\n  const res = await fetch(url, {';

if (c.includes(oldFetch)) {
  c = c.replace(oldFetch, newFetch);
  console.log("Fetch line fixed");
} else {
  console.log("Fetch line pattern not found");
  console.log("Looking for:", oldFetch);
}

fs.writeFileSync(path, c, "utf-8");
console.log("Done");
