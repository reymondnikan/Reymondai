import fs from "node:fs";

const path = "src/ui/apps/nodes/NodesApp.tsx";
const c = fs.readFileSync(path, "utf-8");

// Find the "return (" that starts the main layout
const returnStart = c.indexOf("  return (\n    <div className=\"nodes-app\">");
if (returnStart === -1) {
  console.log("Main return not found");
  process.exit(1);
}

// Find the end of that return (ends with "  );\n}")
const endReturn = c.lastIndexOf("  );\n}");
if (endReturn === -1) {
  console.log("End of return not found");
  process.exit(1);
}

// Extract everything before "return ("
const before = c.substring(0, returnStart);
// Extract everything after ");}"
const after = c.substring(endReturn + "  );\n}".length);

// New main return with tabs
const newReturn = `  return (
    <div className="nodes-app">
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
      ) : (
        <div className="nodes-nodes-view">
          <div className="nodes-list">
            {nodes.map((n) => (
              <div
                key={n.id}
                className={"node-card " + (n.id === selected ? "active" : "")}
                onClick={() => setSelected(n.id)}
              >
                <div className="node-card-header">
                  <span className={"node-status-dot " + (n.connected ? "online" : "offline")} />
                  <span className="node-card-name">{n.name}</span>
                </div>
                <div className="node-card-meta">
                  <span>{n.location}</span>
                  <span>{n.info?.cpuCount ?? "?"} CPU · {n.info?.memoryMb ?? "?"} MB</span>
                </div>
                <div className="node-card-id">{n.id}</div>
              </div>
            ))}
          </div>

          <div className="nodes-detail">
            {selected && <NodeDetail nodeId={selected} onRefresh={load} />}
          </div>
        </div>
      )}
    </div>
  );
}`;

fs.writeFileSync(path, before + newReturn + after, "utf-8");
console.log("NodesApp rewritten");
