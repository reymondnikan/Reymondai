import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// شمارش
const count = (c.match(/const copyUserPageUrl = async/g) || []).length;
console.log("Found " + count + " copies");

// حذف همه
c = c.replace(/const copyUserPageUrl = async [\s\S]*?\n  \};\n/g, "");

// اضافه کردن یکی تازه
const newFn = `const copyUserPageUrl = async (u: XrayUser) => {
    try {
      if (u.owner_telegram_id) {
        const res = await fetch("/api/xray/user-page/" + u.owner_telegram_id, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && data.url) {
            await navigator.clipboard.writeText(data.url);
            setCopied("page_" + u.name);
            setTimeout(() => setCopied(null), 1500);
            return;
          }
        }
      }
      const res = await xrayApi.getUserPageUrl(u.name);
      if (res.ok && res.url) {
        await navigator.clipboard.writeText(res.url);
        setCopied("page_" + u.name);
        setTimeout(() => setCopied(null), 1500);
      }
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    }
  };

`;

// اضافه کردن قبل از showLink
const showLinkIdx = c.indexOf("const showLink =");
if (showLinkIdx === -1) {
  console.log("showLink not found");
  process.exit(1);
}

c = c.substring(0, showLinkIdx) + newFn + c.substring(showLinkIdx);

fs.writeFileSync(path, c, "utf-8");
console.log("Fixed: 1 copy");
