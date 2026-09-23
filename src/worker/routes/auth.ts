// Auth API routes: setup, login, logout, status, tokens, recovery.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { getAuth } from "../runtime";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.get("/status", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ initialized: false });
  return c.json({ initialized: await auth.isInitialized() });
});

authRoutes.post("/setup", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);

  if (await auth.isInitialized()) {
    return c.json({ error: "Already initialized" }, 403);
  }

  const body = await c.req.json<{ username: string; password: string }>();
  const result = await auth.setupOwner(body.username, body.password);

  if (!result.ok) return c.json({ error: result.error }, 400);

  return c.json({
    ok: true,
    recoveryCodes: result.recoveryCodes,
    message: "Store these recovery codes in a safe place. They will not be shown again.",
  });
});

authRoutes.post("/login", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);

  const body = await c.req.json<{ username: string; password: string }>();
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const ua = c.req.header("user-agent") ?? undefined;

  const result = await auth.login({
    username: body.username,
    password: body.password,
    ip,
    userAgent: ua,
  });

  if (!result.ok || !result.session) {
    return c.json({ error: result.error ?? "Login failed" }, 401);
  }

  // Set httpOnly cookie
  const maxAge = Math.floor((result.session.expiresAt - Date.now()) / 1000);
  const cookie = [
    `raymond_session=${result.session.token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ");

  return new Response(
    JSON.stringify({ ok: true, expiresAt: result.session.expiresAt }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": cookie,
      },
    }
  );
});

authRoutes.post("/logout", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);

  const cookieHeader = c.req.header("cookie") ?? "";
  const match = cookieHeader.match(/raymond_session=([^;]+)/);
  if (match) await auth.logout(match[1]);

  const clearCookie = "raymond_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie,
    },
  });
});

authRoutes.get("/me", async (c) => {
  const actor = c.get("actor" as never) as { id: string; type: string } | undefined;
  if (!actor) return c.json({ error: "Unauthorized" }, 401);
  return c.json(actor);
});

authRoutes.post("/tokens", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);

  const actor = c.get("actor" as never) as { id: string } | undefined;
  if (!actor) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{ name: string; expiresInDays?: number }>();
  const token = await auth.createApiToken(actor.id, body);
  return c.json(token);
});

authRoutes.get("/tokens", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);

  const actor = c.get("actor" as never) as { id: string } | undefined;
  if (!actor) return c.json({ error: "Unauthorized" }, 401);

  const list = await auth.listApiTokens(actor.id);
  return c.json(list);
});

authRoutes.delete("/tokens/:id", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);

  await auth.revokeApiToken(c.req.param("id"));
  return c.json({ ok: true });
});

authRoutes.post("/recover", async (c) => {
  const auth = getAuth();
  if (!auth) return c.json({ error: "Server not ready" }, 503);
  if (!(auth instanceof Object) || !("useRecoveryCode" in auth)) {
    return c.json({ error: "Recovery not supported" }, 500);
  }

  const body = await c.req.json<{
    username: string;
    code: string;
    newPassword: string;
  }>();

  const fn = (auth as unknown as {
    useRecoveryCode: (u: string, c: string, p: string) => Promise<{ ok: boolean; error?: string }>;
  }).useRecoveryCode.bind(auth);

  const result = await fn(body.username, body.code, body.newPassword);
  if (!result.ok) return c.json({ error: result.error }, 400);
  return c.json({ ok: true, message: "Password reset. All sessions revoked." });
});
