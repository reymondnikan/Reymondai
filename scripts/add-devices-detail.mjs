import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("devices")) {
  console.log("Already present");
  process.exit(0);
}

// Add the devices detail after the percent detail (📊)
const percentDetailRegex = /(<div className="xray-detail">\s*\n\s*<span className="xray-detail-icon">📊<\/span>[\s\S]*?<\/div>\s*\n)(\s*<\/div>)/;

const match = c.match(percentDetailRegex);
if (!match) {
  console.log("Pattern not found, trying alternative...");
  
  // Alternative: insert before the closing </div> of xray-user-details
  const detailsCloseRegex = /(<\/div>\s*<\/div>\s*\n\s*<div className="xray-user-actions-vertical">)/;
  const m2 = c.match(detailsCloseRegex);
  
  if (m2) {
    console.log("Found alternative pattern");
    const newDetail = `
                      <div className="xray-detail">
                        <span className="xray-detail-icon">📱</span>
                        <span>
                          {u.max_connections > 0 
                            ? "حداکثر " + u.max_connections + " دستگاه"
                            : "بی‌نهایت دستگاه"}
                        </span>
                      </div>
                    `;
    c = c.replace(detailsCloseRegex, newDetail + '\n' + m2[1]);
  } else {
    console.log("No pattern found");
    process.exit(1);
  }
} else {
  const newDetail = `
                      <div className="xray-detail">
                        <span className="xray-detail-icon">📱</span>
                        <span>
                          {u.max_connections > 0 
                            ? "حداکثر " + u.max_connections + " دستگاه"
                            : "بی‌نهایت دستگاه"}
                        </span>
                      </div>
                    `;
  c = c.replace(percentDetailRegex, match[1] + newDetail + match[2]);
}

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
