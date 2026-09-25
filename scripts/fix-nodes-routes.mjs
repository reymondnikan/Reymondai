import fs from "node:fs";

const path = "src/worker/routes/nodes.ts";
let c = fs.readFileSync(path, "utf-8");

// Add listHandler + duplicate routes
if (!c.includes("listHandler")) {
  // Add a handler function
  const handler = `
const listHandler = async (c: any) => {
  const nodes = await queryAll(
    c.env.DB,
    "SELECT id, name, display_name, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at FROM nodes ORDER BY sort_order ASC, created_at ASC"
  );
  return c.json({ ok: true, nodes });
};

// Accept both with and without trailing slash
nodesRoutes.get("", listHandler);
nodesRoutes.get("/", listHandler);
`;

  // Replace the existing GET "/" handler
  c = c.replace(
    /\/\/ List nodes\s*\nnodesRoutes\.get\("\/", async \(c\) => \{[\s\S]*?\}\);/,
    "// List nodes\n" + handler
  );

  fs.writeFileSync(path, c, "utf-8");
  console.log("nodes.ts updated");
} else {
  console.log("Already updated");
}
