// Theme — single source for all colors. Swap this to reskin Raymond.
//
// Later: Raymond can generate this file from natural language.

export const theme = {
  // Backgrounds
  bg: "#0a0a0f",
  bgPanel: "#12121a",
  bgElev: "#1a1a24",
  bgHover: "#1e1e2a",
  border: "#24242f",

  // Text
  text: "#e8e8ee",
  textDim: "#8a8a99",

  // Accent
  accent: "#7c5cff",
  accentSoft: "#7c5cff22",
  accentHover: "#8f74ff",

  // Semantic
  ok: "#38d39f",
  warn: "#ffb84d",
  danger: "#ff4d6d",
  info: "#4d9fff",

  // Layout
  radius: "12px",
  radiusSm: "8px",
  sidebarWidth: "280px",
} as const;

export function applyTheme(): void {
  const r = document.documentElement;
  r.style.setProperty("--bg", theme.bg);
  r.style.setProperty("--bg-panel", theme.bgPanel);
  r.style.setProperty("--bg-elev", theme.bgElev);
  r.style.setProperty("--bg-hover", theme.bgHover);
  r.style.setProperty("--border", theme.border);
  r.style.setProperty("--text", theme.text);
  r.style.setProperty("--text-dim", theme.textDim);
  r.style.setProperty("--accent", theme.accent);
  r.style.setProperty("--accent-soft", theme.accentSoft);
  r.style.setProperty("--ok", theme.ok);
  r.style.setProperty("--warn", theme.warn);
  r.style.setProperty("--danger", theme.danger);
  r.style.setProperty("--info", theme.info);
  r.style.setProperty("--radius", theme.radius);
  r.style.setProperty("--radius-sm", theme.radiusSm);
  r.style.setProperty("--sidebar-width", theme.sidebarWidth);
}
