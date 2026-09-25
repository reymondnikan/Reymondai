import fs from "node:fs";

const path = "src/worker/routes/nodes-crud.ts";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("/metrics/all") && c.includes("/:id/metrics")) {
  console.log("Already has metrics endpoints");
  process.exit(0);
}

// Add metrics endpoints before the LAST "});" of the file
const metricsEndpoints = `
// ============================================================
// Get live metrics for a node
// ============================================================
nodesCrudRoutes.get("/:id/metrics", async (c) => {
  const id = c.req.param("id");
  try {
    const cli = new NodeClient(c.env, id);
    const r = await cli.task<Record<string, unknown>>("system.metrics", {}, 15000);
    if (!r.ok || !r.output) {
      return c.json({ ok: false, error: r.error ?? "metrics failed" }, 500);
    }
    return c.json({ ok: true, metrics: r.output });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});

// ============================================================
// Get metrics for ALL nodes
// ============================================================
nodesCrudRoutes.get("/metrics/all", async (c) => {
  const nodes = await queryAll<{ id: string; display_name: string; flag: string; ip: string }>(
    c.env.DB,
    "SELECT id, display_name, flag, ip FROM nodes WHERE enabled = 1 ORDER BY sort_order ASC"
  );

  const results = await Promise.all(
    nodes.map(async (n) => {
      try {
        const cli = new NodeClient(c.env, n.id);
        const r = await cli.task<Record<string, unknown>>("system.metrics", {}, 15000);
        return {
          id: n.id,
          display_name: n.display_name,
          flag: n.flag,
          ip: n.ip,
          ok: r.ok,
          metrics: r.output ?? null,
          error: r.error ?? null,
        };
      } catch (e) {
        return {
          id: n.id,
          display_name: n.display_name,
          flag: n.flag,
          ip: n.ip,
          ok: false,
          metrics: null,
          error: (e as Error).message,
        };
      }
    })
  );

  return c.json({ ok: true, nodes: results });
});
`;

// Insert at end
const trimmed = c.trimEnd();
const lastClosing = trimmed.lastIndexOf("});");

if (lastClosing === -1) {
  console.log("Cannot find last });");
  process.exit(1);
}

c = trimmed.substring(0, lastClosing + 3) + "\n" + metricsEndpoints;

fs.writeFileSync(path, c, "utf-8");
console.log("metrics endpoints added");
