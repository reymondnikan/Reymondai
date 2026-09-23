// OpenRouter implementation of AIProvider.

import type { AIProvider, AICompleteInput, AICompleteOutput } from "../../core/contracts";

const DEFAULT_MODEL = "deepseek/deepseek-chat-v3-0324:free";

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly name = "OpenRouter";

  constructor(private apiKey: string | null) {}

  async available(): Promise<boolean> {
    return !!this.apiKey;
  }

  async complete(input: AICompleteInput): Promise<AICompleteOutput> {
    if (!this.apiKey) throw new Error("OPENROUTER_API_KEY not configured");
    const model = input.model ?? DEFAULT_MODEL;
    const started = Date.now();

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://raymond.workers.dev",
        "X-Title": "Raymond",
      },
      body: JSON.stringify({
        model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: input.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty response from OpenRouter");

    return {
      content,
      provider: this.id,
      model: json.model ?? model,
      latencyMs: Date.now() - started,
    };
  }

  listModels(): string[] {
    return [
      "deepseek/deepseek-chat-v3-0324:free",
      "deepseek/deepseek-r1:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen-2.5-72b-instruct:free",
    ];
  }

  defaultModel(): string {
    return DEFAULT_MODEL;
  }
}
