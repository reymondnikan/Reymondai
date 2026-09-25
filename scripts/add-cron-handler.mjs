import fs from "node:fs";

const path = "src/worker/index.ts";
let c = fs.readFileSync(path, "utf-8");

// Check if scheduled handler already exists
if (c.includes("async scheduled")) {
  console.log("scheduled handler already exists");
  process.exit(0);
}

// Add import for handleCron
if (!c.includes('from "./cron"')) {
  c = c.replace(
    /(import \{ requireAuth \} from "\.\/middleware\/require-auth";)/,
    '$1\nimport { handleCron } from "./cron";'
  );
}

// Find the export default block and add scheduled handler
const exportMatch = c.match(/export default \{[\s\S]*?\} satisfies ExportedHandler<Env>;/);

if (!exportMatch) {
  console.log("export default not found");
  process.exit(1);
}

const newExport = `export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await bootstrap(env);
    initRuntime(env);
    setEnv(env);
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    initRuntime(env);
    setEnv(env);
    ctx.waitUntil(handleCron(env));
  },
} satisfies ExportedHandler<Env>;`;

c = c.replace(exportMatch[0], newExport);

fs.writeFileSync(path, c, "utf-8");
console.log("scheduled handler added");
