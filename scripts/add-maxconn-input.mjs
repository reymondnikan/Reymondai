import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// Check if already present
if (c.includes('placeholder="Max Devices"')) {
  console.log("Already present");
  process.exit(0);
}

// Find the Days input block (with Persian placeholder)
const daysBlockRegex = /(<input\s+type="number"\s+placeholder="0 = بینهایت"\s+value=\{newDays \|\| ""\}[\s\S]*?\/>\s*<\/div>)/;

const match = c.match(daysBlockRegex);
if (!match) {
  console.log("ERROR: Days input block not found");
  process.exit(1);
}

const originalBlock = match[1];

const newBlock = originalBlock + `

          <div className="xray-form-field">
            <label>حداکثر دستگاه (0=بی‌نهایت)</label>
            <input
              type="number"
              placeholder="0 = بی‌نهایت"
              value={newMaxConn || ""}
              onChange={(e) => setNewMaxConn(parseInt(e.target.value) || 0)}
              min={0}
              disabled={creating}
            />
          </div>`;

c = c.replace(daysBlockRegex, newBlock);

fs.writeFileSync(path, c, "utf-8");
console.log("OK - Max Devices input added");
