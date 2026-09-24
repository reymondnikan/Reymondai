// AI provider that runs on a remote Raymond Node (VPS).

import type {
  AIProvider,
  AICompleteInput,
  AICompleteOutput,
} from "../../core/contracts";
import type { Env } from "../../core/db";
import { NodeClient } from "./node-client";

const DEFAULT_NODE_ID = "hetzner-nbg1-01";
const DEFAULT_MODEL = "qwen2.5:3b";

export class NodeAIProvider implements AIProvider {
  readonly id = "local-node";
  readonly name = "Local AI (VPS)";

  private nodeClient: NodeClient;

  constructor(env: Env, nodeId = DEFAULT_NODE_ID) {
    this.nodeClient = new NodeClient(env, nodeId);
  }

  async available(): Promise<boolean> {
    try {
      const status = await this.nodeClient.status();
      return status.connected === true;
    } catch {
      return false;
    }
  }

  async complete(input: AICompleteInput): Promise<AICompleteOutput> {
    const started = Date.now();
    const model = input.model ?? DEFAULT_MODEL;

    const prompt = input.messages
      .map((m) => {
        if (m.role === "system") return `System: ${m.content}`;
        if (m.role === "user") return `User: ${m.content}`;
        if (m.role === "assistant") return `Assistant: ${m.content}`;
        return m.content;
      })
      .join("\n\n");

    const result = await this.nodeClient.task<{
      stdout: string;
      stderr: string;
    }>("ollama.chat", { model, prompt }, 120000);

    if (!result.ok || !result.output) {
      throw new Error(result.error ?? "Node AI task failed");
    }

    const parsed = JSON.parse(result.output.stdout) as {
      message?: { content?: string };
    };
    const content = parsed.message?.content ?? "";
    if (!content) throw new Error("Empty response from local AI");

    return {
      content,
      provider: this.id,
      model,
      latencyMs: Date.now() - started,
    };
  }

  listModels(): string[] {
    return ["qwen2.5:3b", "qwen2.5:7b", "llama3.2:3b"];
  }

  defaultModel(): string {
    return DEFAULT_MODEL;
  }
}
