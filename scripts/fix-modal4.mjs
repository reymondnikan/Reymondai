import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// Find the wrong pattern
const wrongPattern = `      )}
    </div>

      {/* Edit Modal */}`;

if (!c.includes(wrongPattern)) {
  console.log("Wrong pattern not found");
  process.exit(1);
}

// Find the correct end of the modal block
// Modal ends with: "        </div>\n      )}\n\n  );"
const modalEndPattern = `        </div>
      )}

  );`;

if (!c.includes(modalEndPattern)) {
  console.log("Modal end not found");
  process.exit(1);
}

// Replace: move the </div> AFTER the modal
c = c.replace(wrongPattern, `      )}

      {/* Edit Modal */}`);

// Add </div> before the final );
c = c.replace(modalEndPattern, `        </div>
      )}
    </div>
  );`);

fs.writeFileSync(path, c, "utf-8");
console.log("OK");
