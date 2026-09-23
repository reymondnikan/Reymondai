// Ollama implementation of AIProvider (for a future local VPS).

import type { AIProvider, AICompleteInput, AICompleteOutput } from "../../core/contracts";

const DEFAULT_MODEL = "deepseek-r1:7b";

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";
  readonly name = "Ollama (local)";

  constructor(private baseUrl: string | null) {}

  async available(): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/tags`, {
        method: "GET",
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(input: AICompleteInput): Promise<AICompleteOutput> {
    if (!this.baseUrl) throw new Error("OLLAMA_URL not configured");
    const model = input.model ?? DEFAULT_MODEL;
    const started = Date.now();

    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: { temperature: input.temperature ?? 0.7 },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      message?: { content?: string };
      model?: string;
    };
    const content = json.message?.content ?? "";
    if (!content) throw new Error("Empty response from Ollama");

    return {
      content,
      provider: this.id,
      model: json.model ?? model,
      latencyMs: Date.now() - started,
    };
  }

  listModels(): string[] {
    return ["deepseek-r1:7b", "deepseek-r1:14b", "qwen2.5:7b", "llama3.1:8b"];
  }

  defaultModel(): string {
    return DEFAULT_MODEL;
  }
}
