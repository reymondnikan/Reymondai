import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// Find marker line: "    </div>\n\n      {/* Edit Modal */}"
const marker = "    </div>\n\n      {/* Edit Modal */}";

if (!c.includes(marker)) {
  console.log("Marker not found");
  process.exit(1);
}

// Replace with modal BEFORE the </div>
const fixed = "\n      {/* Edit Modal */}";

// Find the modal block - from "{/* Edit Modal */}" to ")}"
const modalStartIdx = c.indexOf("      {/* Edit Modal */}");
const modalEndIdx = c.indexOf(")}", modalStartIdx) + 2;

// Extract the modal block
const modalBlock = c.substring(modalStartIdx, modalEndIdx);

// Remove the modal from current position
let withoutModal = c.substring(0, modalStartIdx) + c.substring(modalEndIdx);

// Now find the final "    </div>" that closes the main app div
// It's now: "...}\n    </div>\n  );\n}"
const finalClose = withoutModal.lastIndexOf("    </div>\n  );");

if (finalClose === -1) {
  console.log("Final close not found");
  process.exit(1);
}

// Insert modal before the final </div>
const result = withoutModal.substring(0, finalClose) + "\n" + modalBlock + "\n" + withoutModal.substring(finalClose);

fs.writeFileSync(path, result, "utf-8");
console.log("OK - modal moved inside return");
