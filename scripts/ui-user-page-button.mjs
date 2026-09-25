import fs from "node:fs";

const path = "src/ui/apps/xray/XrayApp.tsx";
let c = fs.readFileSync(path, "utf-8");

if (c.includes("copyUserPageUrl")) {
  console.log("Already has copyUserPageUrl");
  process.exit(0);
}

// 1. اضافه کردن تابع copyUserPageUrl قبل از showLink
const helperFn = `
  const copyUserPageUrl = async (name: string) => {
    try {
      const res = await xrayApi.getUserPageUrl(name);
      if (res.ok && res.url) {
        await navigator.clipboard.writeText(res.url);
        setCopied("page_" + name);
        setTimeout(() => setCopied(null), 1500);
      }
    } catch (e) {
      alert("خطا: " + (e instanceof Error ? e.message : String(e)));
    }
  };
`;

// پیدا کردن محل showLink
const showLinkIdx = c.indexOf("const showLink =");
if (showLinkIdx !== -1) {
  c = c.substring(0, showLinkIdx) + helperFn + "\n" + c.substring(showLinkIdx);
}

// 2. اضافه کردن دکمه توی actions
// پیدا کردن actions block
const actionsRegex = /(<div className="xray-user-actions-vertical">[\s\S]*?<button\s+className="xray-action-btn xray-action-danger"[\s\S]*?<\/button>)/;

const match = c.match(actionsRegex);
if (match) {
  const newButton = `
                    <button
                      className="xray-action-btn xray-action-page"
                      onClick={() => copyUserPageUrl(u.name)}
                      title="کپی لینک صفحه کاربر"
                    >
                      {copied === "page_" + u.name ? "✓" : "📱 صفحه"}
                    </button>`;
  
  const replacement = match[1].replace(
    /(\s*<button\s+className="xray-action-btn xray-action-danger")/,
    newButton + "$1"
  );
  
  c = c.replace(actionsRegex, replacement);
}

fs.writeFileSync(path, c, "utf-8");
console.log("XrayApp updated");
