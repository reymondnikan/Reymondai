// AI Registry — chooses which provider to call.
//
// Rules (in priority order):
//   1. If input.model clearly belongs to a provider, use that provider.
//   2. If input.provider is specified, use it.
//   3. Otherwise, pick first available provider (fallback chain).
//
// Later: plug in task-based routing (code -> coder model, etc.)

import type {
  AIProvider,
  AICompleteInput,
  AICompleteOutput,
  AIProviderInfo,
} from "../../core/contracts";

export class AIRegistry {
  private providers = new Map<string, AIProvider>();

  register(p: AIProvider): void {
    this.providers.set(p.id, p);
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id);
  }

  async info(): Promise<AIProviderInfo[]> {
    const out: AIProviderInfo[] = [];
    for (const p of this.providers.values()) {
      out.push({
        id: p.id,
        name: p.name,
        available: await p.available(),
        models: p.listModels(),
        defaultModel: p.defaultModel(),
        description: "",
      });
    }
    return out;
  }

  async complete(
    input: AICompleteInput,
    preferredProvider?: string
  ): Promise<AICompleteOutput> {
    const available: AIProvider[] = [];
    for (const p of this.providers.values()) {
      if (await p.available()) available.push(p);
    }
    if (available.length === 0) throw new Error("No AI providers available");

    // Order: preferred first, then others
    const order = preferredProvider
      ? [
          ...available.filter((p) => p.id === preferredProvider),
          ...available.filter((p) => p.id !== preferredProvider),
        ]
      : available;

    let lastErr: unknown;
    for (const p of order) {
      try {
        return await p.complete(input);
      } catch (e) {
        lastErr = e;
        console.error(`AI provider "${p.id}" failed:`, e);
      }
    }
    throw lastErr ?? new Error("All AI providers failed");
  }
}
