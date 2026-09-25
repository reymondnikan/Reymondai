// Custom bot buttons API.

import { Hono } from "hono";
import type { Env } from "../core/db";
import { queryAll, queryFirst, run } from "../core/db";

export const botButtonsRoutes = new Hono<{ Bindings: Env }>();

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// List all buttons
botButtonsRoutes.get("/", async (c) => {
  const buttons = await queryAll(
    c.env.DB,
    "SELECT id, label, action_type, action_value, visible_to, sort_order, enabled, created_at FROM bot_buttons ORDER BY sort_order ASC, created_at ASC"
  );
  return c.json({
    ok: true,
    buttons: buttons.map((b) => ({ ...b, enabled: b.enabled === 1 })),
  });
});

// Create button
botButtonsRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    label?: string;
    action_type?: string;
    action_value?: string;
    visible_to?: string;
    sort_order?: number;
  }>();

  const label = body.label?.trim();
  if (!label) return c.json({ ok: false, error: "label required" }, 400);

  const actionType = body.action_type ?? "text";
  if (!["text", "url", "callback"].includes(actionType)) {
    return c.json({ ok: false, error: "invalid action_type" }, 400);
  }

  const visibleTo = body.visible_to ?? "all";
  if (!["all", "admins", "users"].includes(visibleTo)) {
    return c.json({ ok: false, error: "invalid visible_to" }, 400);
  }

  const id = "btn_" + randomHex(8);
  const now = Date.now();

  await run(
    c.env.DB,
    "INSERT INTO bot_buttons (id, label, action_type, action_value, visible_to, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
    id,
    label,
    actionType,
    body.action_value ?? "",
    visibleTo,
    body.sort_order ?? 100,
    now,
    now
  );

  return c.json({ ok: true, id });
});

// Update button
botButtonsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const allowed = ["label", "action_type", "action_value", "visible_to", "sort_order", "enabled"];
  const fields: string[] = [];
  const params: unknown[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      fields.push(key + " = ?");
      params.push(key === "enabled" ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (fields.length === 0) return c.json({ ok: false, error: "nothing to update" }, 400);

  fields.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  await run(c.env.DB, `UPDATE bot_buttons SET ${fields.join(", ")} WHERE id = ?`, ...params);
  return c.json({ ok: true });
});

// Delete button
botButtonsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await run(c.env.DB, "DELETE FROM bot_buttons WHERE id = ?", id);
  return c.json({ ok: true });
});
