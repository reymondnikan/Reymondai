import fs from "node:fs";

const path = "src/ui/apps/nodes/api.ts";
let c = fs.readFileSync(path, "utf-8");

// Replace BASE concatenation to be smart
c = c.replace(
  /const res = await fetch\(`\$\{BASE\}\$\{path\}`/,
  'const res = await fetch(path.startsWith("/api/") ? path : `${BASE}${path}`'
);

// Fix the getMetrics and getAllMetrics calls to use full path
c = c.replace(
  /getMetrics: \(id: string\) =>\s*\n\s*req<\{ ok: boolean; metrics: NodeMetrics \}>\("\/api\/nodes-crud\/\$\{id\}\/metrics"\),/,
  'getMetrics: (id: string) =>\n    req<{ ok: boolean; metrics: NodeMetrics }>("/api/nodes-crud/" + id + "/metrics"),'
);

c = c.replace(
  /getAllMetrics: \(\) =>\s*\n\s*req<\{ ok: boolean; nodes: NodeMetricsResult\[\] \}>\("\/api\/nodes-crud\/metrics\/all"\),/,
  'getAllMetrics: () =>\n    req<{ ok: boolean; nodes: NodeMetricsResult[] }>("/api/nodes-crud/metrics/all"),'
);

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
