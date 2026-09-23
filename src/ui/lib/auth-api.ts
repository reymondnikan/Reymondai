// Auth API client for the UI.

export interface AuthStatus {
  initialized: boolean;
}

export interface LoginResult {
  ok: boolean;
  expiresAt: number;
}

export interface SetupResult {
  ok: boolean;
  recoveryCodes: string[];
  message: string;
}

const BASE = "/api/auth";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export const authApi = {
  status: () => req<AuthStatus>("/status"),

  setup: (username: string, password: string) =>
    req<SetupResult>("/setup", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  login: (username: string, password: string) =>
    req<LoginResult>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    req<{ ok: boolean }>("/logout", { method: "POST" }),

  me: () =>
    req<{ id: string; type: string; name: string }>("/me"),

  recover: (username: string, code: string, newPassword: string) =>
    req<{ ok: boolean; message: string }>("/recover", {
      method: "POST",
      body: JSON.stringify({ username, code, newPassword }),
    }),
};
