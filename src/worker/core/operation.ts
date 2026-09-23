// Operation model — every meaningful action becomes an Operation.
//
// Operation lifecycle:
//   pending -> approved -> running -> completed
//                                   -> failed
//                                   -> rolled_back
//   pending -> rejected

import { newId, now } from "./id";
import { queryAll, run } from "./db";
import type { Env } from "./db";
import type { Operation, OperationStatus, RiskLevel } from "../../shared/types";

export interface CreateOperationInput {
  capability_id?: string;
  operation_type: string;
  actor?: string;
  input?: unknown;
  risk?: RiskLevel;
  requires_approval?: boolean;
}

export const operations = {
  async create(env: Env, input: CreateOperationInput): Promise<Operation> {
    const op: Operation = {
      id: newId("op"),
      capability_id: input.capability_id,
      operation_type: input.operation_type,
      actor: input.actor ?? "owner",
      status: "pending",
      input: JSON.stringify(input.input ?? {}),
      risk: input.risk ?? "low",
      requires_approval: input.requires_approval ? 1 : 0,
      created_at: now(),
    };

    await run(
      env.DB,
      `INSERT INTO operations 
        (id, capability_id, operation_type, actor, status, input, risk, requires_approval, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      op.id,
      op.capability_id ?? null,
      op.operation_type,
      op.actor,
      op.status,
      op.input,
      op.risk,
      op.requires_approval,
      op.created_at
    );

    return op;
  },

  async updateStatus(
    env: Env,
    id: string,
    status: OperationStatus,
    patch: Partial<Pick<Operation, "output" | "error" | "approved_by" | "approved_at" | "started_at" | "finished_at">> = {}
  ): Promise<void> {
    const fields: string[] = ["status = ?"];
    const params: unknown[] = [status];

    if (patch.output !== undefined) { fields.push("output = ?"); params.push(patch.output); }
    if (patch.error !== undefined) { fields.push("error = ?"); params.push(patch.error); }
    if (patch.approved_by !== undefined) { fields.push("approved_by = ?"); params.push(patch.approved_by); }
    if (patch.approved_at !== undefined) { fields.push("approved_at = ?"); params.push(patch.approved_at); }
    if (patch.started_at !== undefined) { fields.push("started_at = ?"); params.push(patch.started_at); }
    if (patch.finished_at !== undefined) { fields.push("finished_at = ?"); params.push(patch.finished_at); }

    params.push(id);
    await run(env.DB, `UPDATE operations SET ${fields.join(", ")} WHERE id = ?`, ...params);
  },

  async get(env: Env, id: string): Promise<Operation | null> {
    const rows = await queryAll<Operation>(
      env.DB,
      `SELECT * FROM operations WHERE id = ? LIMIT 1`,
      id
    );
    return rows[0] ?? null;
  },

  async list(env: Env, limit = 100): Promise<Operation[]> {
    return await queryAll<Operation>(
      env.DB,
      `SELECT * FROM operations ORDER BY created_at DESC LIMIT ?`,
      limit
    );
  },
};
