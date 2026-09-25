import fs from "node:fs";

const path = "src/ui/apps/nodes/NodesApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// Check current structure
const mainAppStart = c.indexOf("export function NodesApp");
if (mainAppStart === -1) {
  console.log("NodesApp not found");
  process.exit(1);
}

// Find a place to add tab state — we'll add "activeTab" state
if (!c.includes("activeTab")) {
  // Add state after nodes list
  c = c.replace(
    /(const \[selected, setSelected\] = useState<string \| null>\(null\);)/,
    `$1
  const [activeTab, setActiveTab] = useState<"nodes" | "metrics">("nodes");`
  );
}

// Add tabs at top of return
if (!c.includes('"metrics"') || !c.includes("Nodes / Metrics")) {
  // Find the opening of the main return div
  const returnStart = c.indexOf("return (", mainAppStart);
  if (returnStart !== -1) {
    // Find the first <div className="nodes-app">
    const divStart = c.indexOf('<div className="nodes-app">', returnStart);
    if (divStart !== -1) {
      const tabs = `<div className="nodes-app">
      <div className="nodes-tabs">
        <button
          className={"nodes-tab " + (activeTab === "nodes" ? "active" : "")}
          onClick={() => setActiveTab("nodes")}
        >
          🖥️ Nodes
        </button>
        <button
          className={"nodes-tab " + (activeTab === "metrics" ? "active" : "")}
          onClick={() => setActiveTab("metrics")}
        >
          📊 Metrics
        </button>
      </div>

      {activeTab === "metrics" ? (
        <MetricsView />
      ) : (`;
      
      c = c.substring(0, divStart) + tabs + c.substring(divStart + '<div className="nodes-app">'.length);
      
      // Need to close the ternary at the end of the return
      // Find the last "</div>" before the closing of the return
      // For now, let's just find the closing pattern
      const lastClose = c.lastIndexOf("</div>\n  );");
      if (lastClose !== -1) {
        c = c.substring(0, lastClose) + "</div>\n      )}\n  );" + c.substring(lastClose + "</div>\n  );".length);
      }
    }
  }
}

fs.writeFileSync(path, c, "utf-8");
console.log("NodesApp tabs added");
