import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// Add state
if (!c.includes("newMaxConn")) {
  c = c.replace(
    /const \[newDays, setNewDays\] = useState\(0\);/,
    'const [newDays, setNewDays] = useState(0);\n  const [newMaxConn, setNewMaxConn] = useState(0);'
  );
  console.log("state added");
}

// Add input field - after the Days input
if (!c.includes('placeholder="Max Devices"')) {
  const daysInputRegex = /(<input\s+type="number"\s+placeholder="Days"[\s\S]*?\/>)/;
  const match = c.match(daysInputRegex);
  if (match) {
    const newInput = match[1] + `

          <input
            type="number"
            placeholder="Max Devices (0=∞)"
            value={newMaxConn || ""}
            onChange={(e) => setNewMaxConn(parseInt(e.target.value) || 0)}
            min={0}
            disabled={creating}
            className="xray-num-input"
          />`;
    c = c.replace(daysInputRegex, newInput);
    console.log("input added");
  } else {
    console.log("WARN: Days input not found");
  }
}

// Update create call
if (c.includes("await xrayApi.addUser(name, newQuota, newSpeed, newDays)")) {
  c = c.replace(
    /await xrayApi\.addUser\(name, newQuota, newSpeed, newDays\)/,
    'await xrayApi.addUser(name, newQuota, newSpeed, newDays, newMaxConn)'
  );
  console.log("create call updated");
}

// Reset
c = c.replace(
  /setNewDays\(0\);\n(\s*)\/\/ /g,
  'setNewDays(0);\n$1setNewMaxConn(0);\n$1// '
);

c = c.replace(
  /(setNewQuota\(0\);\s*\n\s*setNewSpeed\(0\);\s*\n\s*setNewDays\(0\);)/,
  '$1\n        setNewMaxConn(0);'
);

fs.writeFileSync(path, c, "utf-8");
console.log("XrayApp.tsx OK");
