// D1 database helper

export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  TELEGRAM_PROXY: DurableObjectNamespace;
  NODE_AGENT: DurableObjectNamespace;
  ENVIRONMENT: string;
  APP_NAME: string;
  OPENROUTER_API_KEY?: string;
  OLLAMA_URL?: string;
  RAYMOND_MASTER_KEY?: string;
  NODE_SECRET?: string;
  NODE_SECRETS?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_ID?: string;
  INTERNAL_API_KEY?: string;
}

export async function queryFirst<T = unknown>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  return (await stmt.first<T>()) ?? null;
}

export async function queryAll<T = unknown>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return (result.results ?? []) as T[];
}

export async function run(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return await stmt.run();
}
