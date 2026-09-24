// Telegram client — using mtcute/web (built for browsers).
// Lazy-loaded so the main app loads fast.

export interface TgSessionInfo {
  id: string;
  phone: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
  authState: "authorized" | "needs_code" | "needs_password" | "offline";
}

interface StoredSession {
  id: string;
  phone: string;
  info: TgSessionInfo;
}

const STORAGE_KEY = "raymond_tg_accounts_v1";

function loadStored(): StoredSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredSession[];
  } catch {
    return [];
  }
}

function saveStored(list: StoredSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

type MtcuteClient = {
  start: (opts: Record<string, unknown>) => Promise<{ id?: unknown; username?: string; displayName?: string }>;
  sendText: (peer: string, text: string) => Promise<unknown>;
  getMe: () => Promise<{ id?: unknown; username?: string; displayName?: string }>;
  call: (req: Record<string, unknown>) => Promise<unknown>;
  getChats?: (opts?: Record<string, unknown>) => Promise<unknown[]>;
  getHistory?: (peer: string, opts?: Record<string, unknown>) => Promise<unknown[]>;
  destroy: () => Promise<void>;
};

type MtcuteModule = {
  TelegramClient: new (opts: Record<string, unknown>) => MtcuteClient;
};

const API_ID = 2496;
const API_HASH = "8da85b0d5bfe62527e5b244c209159c3";

let libPromise: Promise<MtcuteModule> | null = null;

async function loadLib(): Promise<MtcuteModule> {
  if (!libPromise) {
    libPromise = (async () => {
      const mod = (await import("@mtcute/web")) as unknown as MtcuteModule;
      return mod;
    })();
  }
  return libPromise;
}

export class TgManager {
  private clients = new Map<string, MtcuteClient>();
  private sessions: StoredSession[] = loadStored();
  private pending = new Map<string, { client: MtcuteClient; phone: string }>();

  listAccounts(): TgSessionInfo[] {
    return this.sessions.map((s) => s.info);
  }

  async startLogin(phone: string): Promise<{ sessionId: string }> {
    const lib = await loadLib();
    const sessionId = "tg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    const client = new lib.TelegramClient({
      apiId: API_ID,
      apiHash: API_HASH,
      storage: `raymond-${sessionId}`,
    });

    this.pending.set(sessionId, { client, phone });
    return { sessionId };
  }

  async completeLogin(
    sessionId: string,
    code: string,
    password?: string
  ): Promise<TgSessionInfo> {
    const p = this.pending.get(sessionId);
    if (!p) throw new Error("Login session expired");

    try {
      const user = await p.client.start({
        phone: p.phone,
        code: () => code,
        password: () => password ?? "",
      });

      const info: TgSessionInfo = {
        id: sessionId,
        phone: p.phone,
        username: user.username ?? undefined,
        firstName: user.displayName ?? undefined,
        userId: user.id?.toString(),
        authState: "authorized",
      };

      this.sessions.push({ id: sessionId, phone: p.phone, info });
      saveStored(this.sessions);
      this.clients.set(sessionId, p.client);
      this.pending.delete(sessionId);

      return info;
    } catch (err) {
      const e = err as Error & { needs2FA?: boolean };
      if (e.message?.includes("2FA") || e.message?.includes("password")) {
        const error = new Error("2FA password required");
        (error as Error & { needs2FA?: boolean }).needs2FA = true;
        throw error;
      }
      throw err;
    }
  }

  async restoreAll(): Promise<TgSessionInfo[]> {
    const lib = await loadLib();
    const restored: TgSessionInfo[] = [];
    for (const s of this.sessions) {
      try {
        const client = new lib.TelegramClient({
          apiId: API_ID,
          apiHash: API_HASH,
          storage: `raymond-${s.id}`,
        });
        this.clients.set(s.id, client);
        restored.push(s.info);
      } catch (err) {
        console.error("Failed to restore", s.id, err);
      }
    }
    return restored;
  }

  async logout(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (client) {
      try { await client.destroy(); } catch {}
    }
    this.clients.delete(sessionId);
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    saveStored(this.sessions);
  }
}

export const tgManager = new TgManager();
