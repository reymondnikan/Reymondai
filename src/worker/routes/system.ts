// System routes — health, capabilities, operations, providers

import { Hono } from "hono";
import { registry } from "../core/registry";
import { operations } from "../core/operation";
import { queryAll } from "../core/db";
import { listProviders } from "../adapters/ai-router";
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

systemRoutes.get("/providers", (c) => {
  return c.json(listProviders(c.env));
});

systemRoutes.get("/capabilities", async (c) => {
  const rows = await queryAll(
    c.env.DB,
    `SELECT id, name, version, enabled, created_at, updated_at FROM capabilities ORDER BY name`
  );
  return c.json({ registered: registry.list(), stored: rows });
});

systemRoutes.get("/operations", async (c) => {
  const list = await operations.list(c.env, 100);
  return c.json(list);
});
