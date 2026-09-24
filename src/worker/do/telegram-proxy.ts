// Telegram MTProto Relay — Durable Object
//
// Relays WebSocket frames <-> TCP to Telegram datacenters.
// GramJS in the browser connects here, and this object opens a real
// TCP socket to Telegram's servers via cloudflare:sockets.
//
// This is the standard pattern used by Telegram Web K (tweb).

import { connect } from "cloudflare:sockets";

// Telegram DC production addresses.
// Mapping (aligned with tweb's "dc" query param):
//   1 => 149.154.175.53
//   2 => 149.154.167.51
//   3 => 149.154.175.100
//   4 => 149.154.167.91
//   5 => 91.108.56.130
const DC_ADDRESSES: Record<string, string> = {
  "1": "149.154.175.53:443",
  "2": "149.154.167.51:443",
  "3": "149.154.175.100:443",
  "4": "149.154.167.91:443",
  "5": "91.108.56.130:443",
  // Named aliases (kept for tweb compatibility)
  pluto: "149.154.167.51:443",
  venus: "149.154.167.51:443",
  aurora: "149.154.175.100:443",
  vesta: "149.154.167.91:443",
  flora: "91.108.56.130:443",
};

export class TelegramProxy {
  async fetch(request: Request): Promise<Response> {
    const upgrade = request.headers.get("Upgrade");
    if (upgrade !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const url = new URL(request.url);
    const dcParam = url.searchParams.get("dc") ?? "2";
    const target = DC_ADDRESSES[dcParam];
    if (!target) {
      return new Response(`Unknown DC: ${dcParam}`, { status: 400 });
    }

    const [host, portStr] = target.split(":");
    const port = parseInt(portStr, 10);

    let socket;
    try {
      socket = connect(
        { hostname: host, port },
        { secureTransport: "on", allowHalfOpen: false }
      );
    } catch (err) {
      return new Response(
        `TCP connect failed: ${err instanceof Error ? err.message : String(err)}`,
        { status: 502 }
      );
    }

    // Accept the WebSocket
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const writer = socket.writable.getWriter();
    const reader = socket.readable.getReader();

    // Browser -> Telegram
    server.addEventListener("message", async (evt) => {
      try {
        const data = evt.data as ArrayBuffer | string;
        const bytes =
          typeof data === "string"
            ? new TextEncoder().encode(data)
            : new Uint8Array(data);
        await writer.write(bytes);
      } catch (err) {
        console.error("ws->tcp write failed:", err);
        try { server.close(1011, "write error"); } catch {}
      }
    });

    server.addEventListener("close", async () => {
      try { await writer.close(); } catch {}
      try { await reader.cancel(); } catch {}
      try { socket.close(); } catch {}
    });

    server.addEventListener("error", async () => {
      try { await writer.close(); } catch {}
      try { await reader.cancel(); } catch {}
    });

    // Telegram -> Browser
    (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) server.send(value);
        }
      } catch (err) {
        console.error("tcp->ws read failed:", err);
      } finally {
        try { server.close(1000, "closed"); } catch {}
      }
    })();

    return new Response(null, { status: 101, webSocket: client });
  }
}
