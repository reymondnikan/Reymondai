import fs from "node:fs";

const path = "src/worker/index.ts";
let c = fs.readFileSync(path, "utf-8");

// Check if userPageRoutes is imported
if (!c.includes("userPageRoutes")) {
  // Add import
  c = c.replace(
    /(import \{ botButtonsRoutes \} from "\.\/routes\/bot-buttons";)/,
    '$1\nimport { userPageRoutes } from "./routes/user-page";'
  );
  console.log("Import added");
} else {
  console.log("Import already exists");
}

// Check if it's mounted BEFORE the SPA fallback (app.all("*"))
if (!c.includes('app.route("/u"')) {
  // Find the SPA fallback line and insert /u route BEFORE it
  const spaFallbackRegex = /(app\.all\("\*", async \(c\) => \{[\s\S]*?\}\);)/;
  const match = c.match(spaFallbackRegex);
  
  if (match) {
    c = c.replace(spaFallbackRegex, `// Public user page (must come BEFORE the SPA fallback)
app.route("/u", userPageRoutes);

${match[1]}`);
    console.log("Route mounted before SPA fallback");
  } else {
    console.log("SPA fallback not found");
  }
} else {
  console.log("Route already mounted");
}

fs.writeFileSync(path, c, "utf-8");
console.log("Done");
