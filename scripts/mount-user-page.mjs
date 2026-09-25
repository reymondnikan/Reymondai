import fs from "node:fs";

const path = "src/worker/index.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes('app.route("/u"')) {
  console.log("Already mounted");
  process.exit(0);
}

// Find the SPA fallback line: "app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));"
const spaLine = 'app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));';

if (!c.includes(spaLine)) {
  console.log("SPA fallback not found");
  process.exit(1);
}

// Insert /u route BEFORE the SPA fallback
c = c.replace(spaLine, `// Public user page (must come BEFORE the SPA fallback)
app.route("/u", userPageRoutes);

${spaLine}`);

fs.writeFileSync(path, c, "utf-8");
console.log("userPageRoutes mounted");
