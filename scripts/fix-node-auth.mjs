import fs from "node:fs";

const path = "src/worker/do/node-agent.ts";
let c = fs.readFileSync(path, "utf-8");

// Replace verifyNodeSecret call
if (!c.includes("verifyNodeSecret(")) {
  console.log("warning: no verifyNodeSecret call found");
  process.exit(1);
}

// Replace the import
c = c.replace(
  /import \{ verifyNodeSecret \} from "\.\.\/core\/node-auth";/,
  'import { verifyNodeSecret } from "../core/node-auth";'
);

// Replace the verify call
c = c.replace(
  /if \(!verifyNodeSecret\(this\.env\.NODE_SECRET \?\? "", secret\)\) \{/,
  'if (!verifyNodeSecret(this.env.NODE_SECRETS, this.env.NODE_SECRET, nodeId, secret)) {'
);

// Also update the env type in constructor if needed
c = c.replace(
  /private env: \{ NODE_SECRET\?: string \}/,
  'private env: { NODE_SECRETS?: string; NODE_SECRET?: string }'
);

fs.writeFileSync(path, c, "utf-8");
console.log("node-agent.ts updated");
