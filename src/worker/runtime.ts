// Runtime singleton for the current request.

import type { Env } from "./core/db";
import type {
  StorageContract,
  AuthContract,
  SecretsContract,
  EventsContract,
  TelegramContract,
} from "./core/contracts";
import { D1Storage } from "./adapters/storage/d1";
import { CloudflareSecrets } from "./adapters/secrets/cloudflare";
import { DbEventBus } from "./adapters/events/db-bus";
import { D1Auth } from "./adapters/auth/d1-auth";
import { AIRegistry } from "./adapters/ai/registry";
import { WorkersAIProvider } from "./adapters/ai/workers-ai";
import { OpenRouterProvider } from "./adapters/ai/openrouter";
import { OllamaProvider } from "./adapters/ai/ollama";
import { NodeAIProvider } from "./adapters/ai/node-ai";
import { MockTelegram } from "./adapters/telegram/mock";

interface Runtime {
  storage: StorageContract;
  secrets: SecretsContract;
  events: EventsContract;
  auth: AuthContract;
  ai: AIRegistry;
  telegram: TelegramContract;
}

let _runtime: Runtime | null = null;

export function initRuntime(env: Env): Runtime {
  if (_runtime) return _runtime;

  const storage = new D1Storage(env.DB);

  const masterKey = env.RAYMOND_MASTER_KEY;
  const secrets = new CloudflareSecrets(
    env as unknown as Record<string, unknown>,
    storage,
    masterKey ?? "raymond-default-key-changeme"
  );

  const events = new DbEventBus(storage);
  const auth = new D1Auth(storage, masterKey ?? "raymond-default-key-changeme");

  const ai = new AIRegistry();
  ai.register(new NodeAIProvider(env));
  ai.register(new WorkersAIProvider(env.AI));
  ai.register(new OpenRouterProvider(env.OPENROUTER_API_KEY ?? null));
  ai.register(new OllamaProvider(env.OLLAMA_URL ?? null));

  const telegram: TelegramContract = new MockTelegram();

  _runtime = { storage, secrets, events, auth, ai, telegram };
  return _runtime;
}

export function getRuntime(): Runtime | null { return _runtime; }
export function getAuth(): AuthContract | null { return _runtime?.auth ?? null; }
export function getStorage(): StorageContract | null { return _runtime?.storage ?? null; }
export function getEvents(): EventsContract | null { return _runtime?.events ?? null; }
export function getAI(): AIRegistry | null { return _runtime?.ai ?? null; }
export function getTelegram(): TelegramContract | null { return _runtime?.telegram ?? null; }
