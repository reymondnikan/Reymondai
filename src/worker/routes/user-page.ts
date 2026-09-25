// Public user page: /u/:token

import { Hono } from "hono";
import type { Env } from "../core/db";
import { queryFirst } from "../core/db";

export const userPageRoutes = new Hono<{ Bindings: Env }>();

userPageRoutes.get("/:token", async (c) => {
  const token = c.req.param("token");
  const user = await queryFirst<{ name: string }>(
    c.env.DB,
    "SELECT name FROM xray_users WHERE public_token = ? LIMIT 1",
    token
  );

  if (!user) {
    return c.html(renderNotFound(), 404);
  }

  return c.html(renderUserPage(token, c.env.APP_NAME ?? "Raymond"));
});

function renderNotFound(): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>کاربر پیدا نشد</title>
  <style>
    body { background: #0a0a0f; color: #e8e8ee; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #12121a; border: 1px solid #24242f; border-radius: 16px; padding: 40px 30px; text-align: center; max-width: 400px; }
    h1 { color: #ff4d6d; margin: 0 0 12px; }
    p { color: #8a8a99; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>❌ کاربر پیدا نشد</h1>
    <p>لینکی که باز کردی معتبر نیست یا منقضی شده.</p>
  </div>
</body>
</html>`;
}

function renderUserPage(token: string, appName: string): string {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="theme-color" content="#0a0a0f">
  <title>${appName} — اطلاعات اکانت</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 0%, #1a1a2e 0%, #0a0a0f 60%);
      color: #e8e8ee;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      padding: 20px;
      padding-top: 40px;
      display: flex;
      justify-content: center;
    }
    .container { max-width: 480px; width: 100%; }
    .logo {
      display: flex; align-items: center; justify-content: center;
      gap: 10px; font-size: 24px; font-weight: 700; margin-bottom: 8px;
    }
    .logo-dot {
      width: 12px; height: 12px; border-radius: 50%;
      background: #7c5cff; box-shadow: 0 0 20px #7c5cff;
    }
    .subtitle { text-align: center; color: #8a8a99; font-size: 13px; margin-bottom: 30px; }
    .card {
      background: #12121a; border: 1px solid #24242f; border-radius: 16px;
      padding: 24px; margin-bottom: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .user-name { font-size: 20px; font-weight: 700; color: #e8e8ee; font-family: "Courier New", monospace; }
    .status { font-size: 11px; padding: 4px 10px; border-radius: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .status.active { background: #38d39f22; color: #38d39f; }
    .status.warn { background: #ffb84d22; color: #ffb84d; }
    .status.danger { background: #ff4d6d22; color: #ff4d6d; }
    .status.offline { background: #8a8a9922; color: #8a8a99; }
    .quota-block { margin-bottom: 20px; }
    .quota-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #8a8a99; }
    .quota-header strong { color: #e8e8ee; font-size: 15px; }
    .quota-pct { color: #7c5cff; font-weight: 700; }
    .quota-bar { height: 8px; background: #0a0a0f; border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .quota-fill { height: 100%; background: #38d39f; border-radius: 4px; transition: width 0.5s, background 0.3s; }
    .quota-fill.warn { background: #ffb84d; }
    .quota-fill.danger { background: #ff4d6d; }
    .quota-text { font-size: 12px; color: #8a8a99; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .info-item { background: #0a0a0f; border: 1px solid #24242f; border-radius: 10px; padding: 12px; }
    .info-label { font-size: 11px; color: #8a8a99; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-value { font-size: 15px; font-weight: 700; color: #e8e8ee; }
    .link-box {
      background: #0a0a0f; border: 1px solid #24242f; border-radius: 10px;
      padding: 12px; font-family: "Courier New", monospace; font-size: 11px;
      word-break: break-all; color: #8a8a99; line-height: 1.6;
      margin-bottom: 12px; user-select: all;
    }
    .btn-row { display: flex; gap: 8px; margin-bottom: 12px; }
    .btn {
      flex: 1; padding: 12px; border-radius: 10px; font-weight: 700;
      font-size: 14px; cursor: pointer; border: none; transition: opacity 0.15s;
      text-decoration: none; text-align: center; display: block;
    }
    .btn-primary { background: #7c5cff; color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-secondary { background: transparent; border: 1px solid #7c5cff; color: #7c5cff; }
    .btn-secondary:hover { background: #7c5cff22; }
    .qr-wrapper { display: flex; justify-content: center; margin-top: 16px; padding: 16px; background: white; border-radius: 12px; }
    .qr-wrapper img { display: block; max-width: 100%; height: auto; }
    .footer { text-align: center; color: #8a8a99; font-size: 11px; margin-top: 20px; line-height: 1.6; }
    .loader { text-align: center; color: #8a8a99; padding: 60px 20px; font-size: 14px; }
    .error-box { background: #ff4d6d22; border: 1px solid #ff4d6d44; border-radius: 10px; padding: 16px; color: #ff4d6d; font-size: 13px; text-align: center; }
    .expiry-warn { background: #ffb84d22; border: 1px solid #ffb84d44; color: #ffb84d; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; text-align: center; }
    .expiry-danger { background: #ff4d6d22; border: 1px solid #ff4d6d44; color: #ff4d6d; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <span class="logo-dot"></span>
      <span>${appName}</span>
    </div>
    <div class="subtitle">اطلاعات اکانت</div>

    <div id="content">
      <div class="loader">در حال بارگذاری…</div>
    </div>

    <div class="footer">
      این لینک شخصی و محرمانه است — آن را با کسی به اشتراک نگذارید.
    </div>
  </div>

  <script>
    const TOKEN = ${JSON.stringify(token)};

    function formatBytes(bytes) {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i];
    }

    async function load() {
      try {
        const res = await fetch("/api/xray/public/usage/" + TOKEN);
        if (!res.ok) {
          document.getElementById("content").innerHTML = '<div class="error-box">اطلاعات یافت نشد</div>';
          return;
        }
        const data = await res.json();
        if (!data.ok) {
          document.getElementById("content").innerHTML = '<div class="error-box">خطا در دریافت اطلاعات</div>';
          return;
        }
        render(data);
      } catch (e) {
        document.getElementById("content").innerHTML = '<div class="error-box">خطای شبکه</div>';
      }
    }

    function render(data) {
      const u = data.user;
      const percent = u.quota_used_pct || 0;
      const status = u.expired ? "danger" : !u.enabled ? "offline" : percent >= 90 ? "warn" : "active";
      const statusLabel = u.expired ? "منقضی" : !u.enabled ? "غیرفعال" : percent >= 90 ? "هشدار" : "فعال";
      const fillClass = percent >= 100 ? "danger" : percent >= 90 ? "warn" : "";

      const used = formatBytes(u.used_bytes || 0);
      const total = u.quota_gb > 0 ? u.quota_gb + " GB" : "بی‌نهایت";
      const remaining = u.remaining_bytes != null ? formatBytes(u.remaining_bytes) : "بی‌نهایت";
      const daysLeft = u.days_remaining != null ? u.days_remaining + " روز" : "بی‌نهایت";
      const speed = u.speed_mbps > 0 ? u.speed_mbps + " Mbps" : "بی‌نهایت";

      let warn = "";
      if (u.expired) {
        warn = '<div class="expiry-danger">⛔ اکانت منقضی شده — لطفاً تمدید کنید</div>';
      } else if (u.days_remaining !== null && u.days_remaining <= 3 && u.days_remaining >= 0) {
        warn = '<div class="expiry-warn">⚠️ فقط ' + u.days_remaining + ' روز تا انقضا</div>';
      } else if (percent >= 100) {
        warn = '<div class="expiry-danger">⛔ حجم مصرفی تمام شده — لطفاً تمدید کنید</div>';
      } else if (percent >= 90) {
        warn = '<div class="expiry-warn">⚠️ ' + percent.toFixed(0) + '٪ از حجم مصرف شده</div>';
      }

      const subUrl = location.origin + "/api/xray/sub/" + TOKEN;
      const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=" + encodeURIComponent(subUrl);

      document.getElementById("content").innerHTML = \`
        <div class="card">
          \${warn}
          <div class="card-header">
            <div class="user-name">\${u.name}</div>
            <div class="status \${status}">\${statusLabel}</div>
          </div>

          <div class="quota-block">
            <div class="quota-header">
              <span><strong>\${used}</strong> / \${total}</span>
              <span class="quota-pct">\${u.quota_gb > 0 ? percent.toFixed(1) + "٪" : ""}</span>
            </div>
            <div class="quota-bar">
              <div class="quota-fill \${fillClass}" style="width: \${Math.min(100, percent)}%"></div>
            </div>
            <div class="quota-text">باقی‌مانده: \${remaining}</div>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">زمان باقی‌مانده</div>
              <div class="info-value">\${daysLeft}</div>
            </div>
            <div class="info-item">
              <div class="info-label">سرعت</div>
              <div class="info-value">\${speed}</div>
            </div>
          </div>

          <div class="info-label" style="margin-bottom: 8px;">🔗 لینک اتصال</div>
          <div class="link-box">\${subUrl}</div>

          <div class="btn-row">
            <button class="btn btn-primary" onclick="copyLink('\${subUrl}')">📋 کپی لینک</button>
            <a class="btn btn-secondary" href="\${qrUrl}" target="_blank" rel="noopener">📷 QR Code</a>
          </div>

          <div class="qr-wrapper">
            <img src="\${qrUrl}" alt="QR Code" />
          </div>
        </div>
      \`;
    }

    function copyLink(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => alert("✓ لینک کپی شد"));
      } else {
        prompt("لینک را کپی کنید:", text);
      }
    }

    load();
  </script>
</body>
</html>`;
}
