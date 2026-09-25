// System routes — health, capabilities, operations, providers

import { Hono } from "hono";
import { registry } from "../core/registry";
import { operations } from "../core/operation";
import { queryAll } from "../core/db";
import { getAI } from "../runtime";
import { handleCron } from "../cron";
import type { Env } from "../core/db";

export const systemRoutes = new Hono<{ Bindings: Env }>();

systemRoutes.get("/health", (c) => {
  return c.json({
    ok: true,
    app: c.env.APP_NAME,
    env: c.env.ENVIRONMENT,
    time: Date.now(),
  });
});

systemRoutes.get("/providers", async (c) => {
  const ai = getAI();
  if (!ai) return c.json([]);
  return c.json(await ai.info());
});

systemRoutes.get("/capabilities", async (c) => {
  const rows = await queryAll(
    c.env.DB,
    "SELECT id, name, version, enabled, created_at, updated_at FROM capabilities ORDER BY name"
  );
  return c.json({ registered: registry.list(), stored: rows });
});

systemRoutes.get("/operations", async (c) => {
  const list = await operations.list(c.env, 100);
  return c.json(list);
});

systemRoutes.post("/run-cron", async (c) => {
  try {
    await handleCron(c.env);
    return c.json({ ok: true, message: "Cron executed" });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 500);
  }
});
