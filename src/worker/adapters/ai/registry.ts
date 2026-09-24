// AI Registry — chooses which provider to call.
//
// Selection priority:
//   1. explicit "provider" in the request (per-message override)
//   2. config default (stored in D1 settings, key = "ai.default_provider")
//   3. first available from: local-node → workers-ai → openrouter → ollama

import type {
  AIProvider,
  AICompleteInput,
  AICompleteOutput,
  AIProviderInfo,
} from "../../core/contracts";

export class AIRegistry {
  private providers = new Map<string, AIProvider>();
  private defaultProviderId: string | null = null;

  register(p: AIProvider): void {
    this.providers.set(p.id, p);
  }

  setDefaultProvider(id: string | null): void {
    this.defaultProviderId = id;
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

    // Build priority order
    const priority: string[] = [];
    if (preferredProvider) priority.push(preferredProvider);
    if (this.defaultProviderId && this.defaultProviderId !== preferredProvider) {
      priority.push(this.defaultProviderId);
    }
    // Fallback chain
    for (const id of ["local-node", "workers-ai", "openrouter", "ollama"]) {
      if (!priority.includes(id)) priority.push(id);
    }

    const ordered: AIProvider[] = [];
    for (const id of priority) {
      const p = available.find((x) => x.id === id);
      if (p) ordered.push(p);
    }

    let lastErr: unknown;
    for (const p of ordered) {
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
