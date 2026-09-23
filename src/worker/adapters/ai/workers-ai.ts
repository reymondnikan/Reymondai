// Workers AI implementation of AIProvider.

import type { AIProvider, AICompleteInput, AICompleteOutput } from "../../core/contracts";

const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export class WorkersAIProvider implements AIProvider {
  readonly id = "workers-ai";
  readonly name = "Cloudflare Workers AI";

  constructor(private ai: Ai) {}

  async available(): Promise<boolean> {
    return true;
  }

  async complete(input: AICompleteInput): Promise<AICompleteOutput> {
    const model = input.model ?? DEFAULT_MODEL;
    const started = Date.now();
    const response = (await this.ai.run(model as never, {
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: input.temperature ?? 0.7,
    })) as { response?: string };
    const content = response?.response ?? "";
    if (!content) throw new Error("Empty response from Workers AI");
    return {
      content,
      provider: this.id,
      model,
      latencyMs: Date.now() - started,
    };
  }

  listModels(): string[] {
    return [
      "@cf/meta/llama-4-scout-17b-16e-instruct",
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/qwen/qwen2.5-coder-32b-instruct",
    ];
  }

  defaultModel(): string {
    return DEFAULT_MODEL;
  }
}
