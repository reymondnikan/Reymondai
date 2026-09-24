// Hono middleware — requires authentication for all protected routes.

import type { Context, Next } from "hono";
import type { Env } from "../core/db";
import type { Actor } from "../core/contracts";
import { getAuth } from "../runtime";

declare module "hono" {
  interface ContextVariableMap {
    actor: Actor;
  }
}

const PUBLIC_PATHS = [
  "/api/system/health",
  "/api/auth/setup",
  "/api/auth/login",
  "/api/auth/recover",
  "/api/auth/status",
  "/api/xray/sub",
  "/api/xray/public/usage",
];

export function requireAuth() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const path = new URL(c.req.url).pathname;

    if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
      return await next();
    }

    const auth = getAuth();
    if (!auth) return c.json({ error: "Server not ready" }, 503);

    let token: string | undefined;
    const cookieHeader = c.req.header("cookie") ?? "";
    const cookies = parseCookies(cookieHeader);
    if (cookies["raymond_session"]) token = cookies["raymond_session"];

    if (!token) {
      const authz = c.req.header("authorization") ?? "";
      if (authz.startsWith("Bearer ")) token = authz.slice(7);
    }

    if (!token) return c.json({ error: "Unauthorized" }, 401);

    const actor =
      (await auth.verifySession(token)) ?? (await auth.verifyApiToken(token));

    if (!actor) return c.json({ error: "Unauthorized" }, 401);

    c.set("actor", actor);
    await next();
  };
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (k && v.length) out[k] = decodeURIComponent(v.join("="));
  });
  return out;
}
