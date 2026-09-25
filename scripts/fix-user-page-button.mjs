import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

// حذف copyUserPageUrl قدیمی
c = c.replace(/const copyUserPageUrl = async \(name: string\) \{[\s\S]*?\n  \};\n/g, "");

// تابع جدید: اگه owner_telegram_id داره، از /user-page/:telegramId استفاده کن
const newFn = `const copyUserPageUrl = async (u: XrayUser) => {
    try {
      // اگه owner_telegram_id داره، از پنل کاربر استفاده کن
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
      // fallback: لینک قدیمی
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

// insert before showLink
const showLinkIdx = c.indexOf("const showLink =");
if (showLinkIdx === -1) {
  console.log("showLink not found");
  process.exit(1);
}
c = c.substring(0, showLinkIdx) + newFn + "\n" + c.substring(showLinkIdx);

// دکمه رو آپدیت: u.name → u
c = c.replace(/onClick=\{\(\) => copyUserPageUrl\(u\.name\)\}/g, 'onClick={() => copyUserPageUrl(u)}');

fs.writeFileSync(path, c, "utf-8");
console.log("XrayApp updated");
