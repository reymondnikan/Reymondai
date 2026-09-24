// Node management API — requires auth.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { NodeClient } from "../adapters/ai/node-client";

export const nodeApiRoutes = new Hono<{ Bindings: Env }>();

const NODE_ID = "hetzner-nbg1-01";

function client(env: Env): NodeClient {
  return new NodeClient(env, NODE_ID);
}

const listHandler = async (c: any) => {
  const cli = client(c.env);
  try {
    const status = await cli.status();
    return c.json([
      {
        id: NODE_ID,
        name: "Hetzner Nuremberg",
        location: "Germany",
        connected: status.connected,
        info: status.node?.info ?? null,
        lastHeartbeat: status.node?.lastHeartbeat ?? null,
        connectedAt: status.node?.connectedAt ?? null,
      },
    ]);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
};

// Accept both /api/nodes and /api/nodes/
nodeApiRoutes.get("", listHandler);
nodeApiRoutes.get("/", listHandler);

nodeApiRoutes.get("/:id/info", async (c) => {
  const cli = client(c.env);
  const r = await cli.task("system.info");
  return c.json(r);
});

nodeApiRoutes.get("/:id/services", async (c) => {
  const cli = client(c.env);
  const r = await cli.task("system.services");
  return c.json(r);
});

nodeApiRoutes.get("/:id/disk", async (c) => {
  const cli = client(c.env);
  const r = await cli.task("system.disk");
  return c.json(r);
});

nodeApiRoutes.get("/:id/cpu", async (c) => {
  const cli = client(c.env);
  const r = await cli.task("system.cpu");
  return c.json(r);
});

nodeApiRoutes.get("/:id/uptime", async (c) => {
  const cli = client(c.env);
  const r = await cli.task("system.uptime");
  return c.json(r);
});

nodeApiRoutes.post("/:id/services/:service/restart", async (c) => {
  const service = c.req.param("service");
  const cli = client(c.env);
  const r = await cli.task("service.restart", { service }, 30000);
  return c.json(r);
});

nodeApiRoutes.get("/:id/services/:service/status", async (c) => {
  const service = c.req.param("service");
  const cli = client(c.env);
  const r = await cli.task("service.status", { service }, 20000);
  return c.json(r);
});

nodeApiRoutes.post("/:id/task", async (c) => {
  const body = await c.req.json<{
    task: string;
    payload?: Record<string, unknown>;
    timeoutMs?: number;
  }>();
  if (!body?.task) return c.json({ error: "task required" }, 400);

  const allowed = [
    "system.info",
    "system.cpu",
    "system.disk",
    "system.uptime",
    "system.services",
    "service.restart",
    "service.status",
    "xray.users.list",
    "xray.sync",
    "xray.stats",
    "xray.restart",
    "ollama.list",
    "ollama.chat",
    "shell.exec",
    "ping",
  ];
  if (!allowed.includes(body.task)) {
    return c.json({ error: `Task not allowed: ${body.task}` }, 403);
  }

  const cli = client(c.env);
  const r = await cli.task(body.task, body.payload, body.timeoutMs ?? 60000);
  return c.json(r);
});
