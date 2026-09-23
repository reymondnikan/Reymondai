// D1 implementation of StorageContract.

import type { StorageContract, QueryResult } from "../../core/contracts";

export class D1Storage implements StorageContract {
  constructor(private db: D1Database) {}

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.all<T>();
    return (result.results ?? []) as T[];
  }

  async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql).bind(...params);
    const row = await stmt.first<T>();
    return row ?? null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const stmt = this.db.prepare(sql).bind(...params);
    const result = await stmt.run();
    return {
      rows: [],
      rowsAffected: (result.meta && (result.meta as { changes?: number }).changes) ?? 0,
    };
  }

  async insert(table: string, data: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => data[k]);
    const sql = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
    await this.execute(sql, values);
  }

  async update(
    table: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<void> {
    const setKeys = Object.keys(data);
    const whereKeys = Object.keys(where);
    if (setKeys.length === 0) return;
    const setClause = setKeys.map((k) => `${k} = ?`).join(", ");
    const whereClause = whereKeys.map((k) => `${k} = ?`).join(" AND ");
    const values = [
      ...setKeys.map((k) => data[k]),
      ...whereKeys.map((k) => where[k]),
    ];
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    await this.execute(sql, values);
  }

  async delete(table: string, where: Record<string, unknown>): Promise<void> {
    const whereKeys = Object.keys(where);
    if (whereKeys.length === 0) throw new Error("delete() called with empty where");
    const whereClause = whereKeys.map((k) => `${k} = ?`).join(" AND ");
    const values = whereKeys.map((k) => where[k]);
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    await this.execute(sql, values);
  }

  async transaction<T>(fn: (tx: StorageContract) => Promise<T>): Promise<T> {
    // D1 doesn't expose true transactions from Workers. We rely on sequential
    // operations being idempotent. This can be upgraded to batch() later.
    return await fn(this);
  }

  async ping(): Promise<boolean> {
    try {
      await this.db.prepare("SELECT 1").first();
      return true;
    } catch {
      return false;
    }
  }
}
