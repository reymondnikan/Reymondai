// HTTP client for talking to a Raymond Node (via the Node Agent DO).

import type { Env } from "../../core/db";

export interface NodeStatus {
  connected: boolean;
  node?: {
    nodeId: string;
    info?: Record<string, unknown>;
    lastHeartbeat: number;
    connectedAt: number;
  };
}

export interface NodeTaskResult<T = unknown> {
  type: string;
  id: string;
  ok: boolean;
  output?: T;
  error?: string;
}

export class NodeClient {
  constructor(private env: Env, private nodeId: string) {}

  async status(): Promise<NodeStatus> {
    const id = this.env.NODE_AGENT.idFromName(this.nodeId);
    const stub = this.env.NODE_AGENT.get(id);
    const url = new URL("https://internal/status");
    const res = await stub.fetch(url.toString());
    return (await res.json()) as NodeStatus;
  }

  async task<T = unknown>(
    task: string,
    payload?: Record<string, unknown>,
    timeoutMs = 30000
  ): Promise<NodeTaskResult<T>> {
    const id = this.env.NODE_AGENT.idFromName(this.nodeId);
    const stub = this.env.NODE_AGENT.get(id);
    const url = new URL("https://internal/task");
    const res = await stub.fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, payload, timeoutMs }),
    });
    return (await res.json()) as NodeTaskResult<T>;
  }
}
