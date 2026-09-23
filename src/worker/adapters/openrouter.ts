// OpenRouter adapter — access to many free models through one API.
//
// Setup: get a free key at https://openrouter.ai/keys
// Then run:  wrangler secret put OPENROUTER_API_KEY
//
// Free models include (as of writing):
//   - deepseek/deepseek-chat-v3-0324:free
//   - meta-llama/llama-3.3-70b-instruct:free
//   - google/gemma-3-27b-it:free
//   - qwen/qwen-2.5-72b-instruct:free
//   - mistralai/mistral-small-3.1-24b-instruct:free

import type { Env } from "../core/db";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface OpenRouterInput {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  apiKey: string;
}

export interface OpenRouterOutput {
  content: string;
  model: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouter(
  input: OpenRouterInput
): Promise<OpenRouterOutput> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${input.apiKey}`,
      "HTTP-Referer": "https://raymond.workers.dev",
      "X-Title": "Raymond",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };

  const content = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Empty response from OpenRouter");

  return { content, model: json.model ?? input.model };
}

export function getOpenRouterKey(env: Env): string | null {
  const key = (env as unknown as { OPENROUTER_API_KEY?: string }).OPENROUTER_API_KEY;
  return key && key.length > 0 ? key : null;
}
