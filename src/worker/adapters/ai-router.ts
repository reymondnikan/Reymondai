// AI Router — chooses the best provider/model for the task.
//
// Supported providers:
//   - workers-ai   (Cloudflare Workers AI, free tier, default)
//   - openrouter   (many free models via OpenRouter, needs OPENROUTER_API_KEY)
//   - ollama       (local, needs OLLAMA_URL) — for later on VPS
//
// Fallback chain: if the requested provider fails, try the next available one.

import type { Env } from "../core/db";
import { callOpenRouter, getOpenRouterKey } from "./openrouter";
import { callOllama, getOllamaUrl } from "./ollama";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CompleteInput {
  messages: ChatMessage[];
  provider?: string;
  model?: string;
  temperature?: number;
}

export interface CompleteOutput {
  content: string;
  provider: string;
  model: string;
}

export const DEFAULT_PROVIDER = "workers-ai";
export const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat-v3-0324:free";

export interface ProviderInfo {
  id: string;
  name: string;
  available: boolean;
  default_model: string;
  description: string;
}

export function listProviders(env: Env): ProviderInfo[] {
  return [
    {
      id: "workers-ai",
      name: "Cloudflare Workers AI",
      available: true,
      default_model: DEFAULT_WORKERS_AI_MODEL,
      description: "Free tier, built into Cloudflare, no API key needed",
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      available: !!getOpenRouterKey(env),
      default_model: DEFAULT_OPENROUTER_MODEL,
      description: "Access to many free models; requires OPENROUTER_API_KEY",
    },
    {
      id: "ollama",
      name: "Ollama (local)",
      available: !!getOllamaUrl(env),
      default_model: "qwen2.5:7b",
      description: "Local models on your own server; requires OLLAMA_URL",
    },
  ];
}

export const aiRouter = {
  async complete(env: Env, input: CompleteInput): Promise<CompleteOutput> {
    const provider = input.provider ?? DEFAULT_PROVIDER;

    // Try the requested provider first
    try {
      return await this.callProvider(env, provider, input);
    } catch (err) {
      console.error(`Provider "${provider}" failed:`, err);

      // Fallback chain
      const fallbacks = ["workers-ai", "openrouter"].filter((p) => p !== provider);
      for (const fb of fallbacks) {
        try {
          const info = listProviders(env).find((p) => p.id === fb);
          if (!info?.available) continue;
          return await this.callProvider(env, fb, { ...input, model: undefined });
        } catch (e2) {
          console.error(`Fallback "${fb}" failed:`, e2);
        }
      }
      throw err;
    }
  },

  async callProvider(
    env: Env,
    provider: string,
    input: CompleteInput
  ): Promise<CompleteOutput> {
    switch (provider) {
      case "workers-ai": {
        const model = input.model ?? DEFAULT_WORKERS_AI_MODEL;
        const response = (await env.AI.run(model as never, {
          messages: input.messages,
          temperature: input.temperature ?? 0.7,
        })) as { response?: string };
        const content = response?.response ?? "";
        if (!content) throw new Error("Empty response from Workers AI");
        return { content, provider: "workers-ai", model };
      }

      case "openrouter": {
        const key = getOpenRouterKey(env);
        if (!key) throw new Error("OPENROUTER_API_KEY is not set");
        const model = input.model ?? DEFAULT_OPENROUTER_MODEL;
        const out = await callOpenRouter({
          model,
          messages: input.messages,
          temperature: input.temperature,
          apiKey: key,
        });
        return { content: out.content, provider: "openrouter", model: out.model };
      }

      case "ollama": {
        const url = getOllamaUrl(env);
        if (!url) throw new Error("OLLAMA_URL is not set");
        const model = input.model ?? "qwen2.5:7b";
        const out = await callOllama({
          url,
          model,
          messages: input.messages,
          temperature: input.temperature,
        });
        return { content: out.content, provider: "ollama", model: out.model };
      }

      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  },
};
