// Audit log — immutable record of important actions.

import { newId, now } from "./id";
import { run } from "./db";
import type { Env } from "./db";

export interface AuditInput {
  actor: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: unknown;
  ip?: string;
}

export async function audit(env: Env, input: AuditInput): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO audit_log (id, actor, action, resource_type, resource_id, metadata, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId("aud"),
    input.actor,
    input.action,
    input.resource_type ?? null,
    input.resource_id ?? null,
    JSON.stringify(input.metadata ?? {}),
    input.ip ?? null,
    now()
  );
}
