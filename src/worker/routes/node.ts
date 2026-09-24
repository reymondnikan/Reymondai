// Node Agent routes  WebSocket + task API.

import { Hono } from "hono";
import type { Env } from "../core/db";

export const nodeRoutes = new Hono<{ Bindings: Env }>();

// WebSocket from the node
nodeRoutes.get("/ws", async (c) => {
  const upgrade = c.req.header("Upgrade");
  if (upgrade !== "websocket") {
    return c.text("Expected WebSocket upgrade", 426);
  }

  const nodeId = c.req.header("X-Raymond-Node-Id") ?? "default";
  const id = c.env.NODE_AGENT.idFromName(nodeId);
  const stub = c.env.NODE_AGENT.get(id);
  return stub.fetch(c.req.raw);
});

// HTTP status
nodeRoutes.get("/:nodeId/status", async (c) => {
  const nodeId = c.req.param("nodeId");
  const id = c.env.NODE_AGENT.idFromName(nodeId);
  const stub = c.env.NODE_AGENT.get(id);
  const url = new URL(c.req.url);
  url.pathname = "/status";
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// HTTP task execution
nodeRoutes.post("/:nodeId/task", async (c) => {
  const nodeId = c.req.param("nodeId");
  const id = c.env.NODE_AGENT.idFromName(nodeId);
  const stub = c.env.NODE_AGENT.get(id);
  const url = new URL(c.req.url);
  url.pathname = "/task";
  return stub.fetch(
    new Request(url.toString(), {
      method: "POST",
      headers: c.req.raw.headers,
      body: await c.req.raw.text(),
    })
  );
});
