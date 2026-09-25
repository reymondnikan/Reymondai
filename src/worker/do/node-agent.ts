// Node Agent Durable Object
// Bridges Cloudflare and a remote Raymond Node (e.g. the VPS).

import { verifyNodeSecret } from "../core/node-auth";

interface HelloMessage {
  type: "hello";
  nodeId: string;
  hostname?: string;
  platform?: string;
  arch?: string;
  cpuCount?: number;
  memoryMb?: number;
  uptime?: number;
}

interface HeartbeatMessage {
  type: "heartbeat";
  nodeId: string;
  uptime?: number;
  loadAvg?: number[];
  freeMemMb?: number;
  timestamp?: number;
}

interface TaskResultMessage {
  type: "task_result";
  id: string;
  ok: boolean;
  output?: unknown;
  error?: string;
}

interface NodeState {
  nodeId: string;
  info: HelloMessage;
  lastHeartbeat: number;
  connectedAt: number;
}

const STORAGE_KEY = "node-state";

export class NodeAgent {
  private node: NodeState | null = null;
  private ws: WebSocket | null = null;
  private pending = new Map<string, (msg: TaskResultMessage) => void>();

  constructor(
    private state: DurableObjectState,
    private env: { NODE_SECRETS?: string; NODE_SECRET?: string }
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgrade = request.headers.get("Upgrade");

    // WebSocket from the node agent
    if (upgrade === "websocket") {
      // Authenticate
      const secret = request.headers.get("X-Raymond-Node-Secret") ?? "";
      const nodeId = request.headers.get("X-Raymond-Node-Id") ?? "";
      if (!verifyNodeSecret(this.env.NODE_SECRETS, this.env.NODE_SECRET, nodeId, secret)) {
        return new Response("Unauthorized", { status: 401 });
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      server.accept();
      this.attachNode(nodeId, server);
      return new Response(null, { status: 101, webSocket: client });
    }

    // HTTP: status / task submission
    if (url.pathname.endsWith("/status")) {
      const stored = await this.state.storage.get<NodeState>(STORAGE_KEY);
      return Response.json({
        connected: this.ws !== null,
        node: stored ?? this.node,
      });
    }

    if (url.pathname.endsWith("/task") && request.method === "POST") {
      const body = (await request.json()) as {
        task: string;
        payload?: Record<string, unknown>;
        timeoutMs?: number;
      };
      try {
        const result = await this.runTask(body.task, body.payload, body.timeoutMs);
        return Response.json(result);
      } catch (err) {
        return Response.json(
          { ok: false, error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  }

  private attachNode(nodeId: string, ws: WebSocket): void {
    // Close any existing connection
    if (this.ws && this.ws !== ws) {
      try { this.ws.close(1000, "replaced"); } catch {}
    }
    this.ws = ws;
    const now = Date.now();
    this.node = {
      nodeId,
      info: { type: "hello", nodeId },
      lastHeartbeat: now,
      connectedAt: now,
    };

    ws.addEventListener("message", (evt) => {
      try {
        const data = evt.data as string;
        const msg = JSON.parse(data);

        if (msg.type === "hello") {
          this.node = {
            nodeId: msg.nodeId ?? nodeId,
            info: msg as HelloMessage,
            lastHeartbeat: Date.now(),
            connectedAt: this.node?.connectedAt ?? Date.now(),
          };
          void this.state.storage.put(STORAGE_KEY, this.node);
        } else if (msg.type === "heartbeat") {
          if (this.node) {
            this.node.lastHeartbeat = Date.now();
            this.node.info.uptime = (msg as HeartbeatMessage).uptime;
          }
        } else if (msg.type === "task_result") {
          const result = msg as TaskResultMessage;
          const resolver = this.pending.get(result.id);
          if (resolver) {
            resolver(result);
            this.pending.delete(result.id);
          }
        }
      } catch (err) {
        console.error("Bad message from node:", err);
      }
    });

    ws.addEventListener("close", () => {
      if (this.ws === ws) {
        this.ws = null;
        this.node = null;
      }
    });

    ws.addEventListener("error", (evt) => {
      console.error("Node WS error:", evt);
    });

    // Initialize storage
    void this.state.storage.put(STORAGE_KEY, this.node);
  }

  async runTask(
    task: string,
    payload?: Record<string, unknown>,
    timeoutMs = 30000
  ): Promise<TaskResultMessage> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Node not connected");
    }

    const id = crypto.randomUUID();
    return await new Promise<TaskResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Task timed out: ${task}`));
      }, timeoutMs);

      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });

      this.ws!.send(JSON.stringify({ type: "task", id, task, payload }));
    });
  }
}
