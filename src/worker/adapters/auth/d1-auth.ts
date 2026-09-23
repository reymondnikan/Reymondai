// D1-backed implementation of AuthContract.

import type {
  AuthContract,
  AuthResult,
  Actor,
  ApiToken,
  ApiTokenInput,
  LoginInput,
  StorageContract,
} from "../../core/contracts";
import { hashPassword, verifyPassword, hashString } from "./password";
import { signJwt, verifyJwt } from "./jwt";

const SESSION_DAYS = 30;
const API_TOKEN_DAYS = 365;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RECOVERY_CODE_COUNT = 10;

export class D1Auth implements AuthContract {
  constructor(
    private storage: StorageContract,
    private jwtSecret: string
  ) {}

  async isInitialized(): Promise<boolean> {
    const row = await this.storage.queryOne<{ id: string }>(
      "SELECT id FROM users LIMIT 1"
    );
    return !!row;
  }

  async setupOwner(
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string; recoveryCodes?: string[] }> {
    if (await this.isInitialized()) {
      return { ok: false, error: "Already initialized" };
    }
    if (!username || username.length < 3) {
      return { ok: false, error: "Username too short" };
    }
    if (!password || password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters" };
    }

    const id = "user_" + randomHex(12);
    const { hash, salt } = await hashPassword(password);
    const now = Date.now();

    await this.storage.execute(
      "INSERT INTO users (id, username, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, username, hash, salt, now]
    );

    // Generate recovery codes
    const recoveryCodes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const code = `RAY-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}`.toUpperCase();
      recoveryCodes.push(code);
      const codeHash = await hashString(code);
      await this.storage.execute(
        "INSERT INTO recovery_codes (id, actor_id, code_hash, used, created_at) VALUES (?, ?, ?, 0, ?)",
        ["rc_" + randomHex(12), id, codeHash, now]
      );
    }

    return { ok: true, recoveryCodes };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    // 1. Rate limit by IP
    const recent = await this.storage.query<{ success: number }>(
      "SELECT success FROM login_attempts WHERE ip = ? AND created_at > ? ORDER BY created_at DESC LIMIT ?",
      [input.ip ?? "unknown", Date.now() - LOCKOUT_MINUTES * 60 * 1000, MAX_LOGIN_ATTEMPTS]
    );
    const failedCount = recent.filter((r) => !r.success).length;
    if (failedCount >= MAX_LOGIN_ATTEMPTS) {
      await this.recordAttempt(input.ip ?? "unknown", input.username, false);
      return { ok: false, error: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` };
    }

    // 2. Find user
    const user = await this.storage.queryOne<{
      id: string;
      password_hash: string;
      password_salt: string;
    }>(
      "SELECT id, password_hash, password_salt FROM users WHERE username = ? LIMIT 1",
      [input.username]
    );

    // 3. Verify password (constant time even if user not found)
    const ok = user
      ? await verifyPassword(input.password, user.password_hash, user.password_salt)
      : await verifyPassword(input.password, "AAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAA==");

    await this.recordAttempt(input.ip ?? "unknown", input.username, ok);

    if (!ok || !user) {
      return { ok: false, error: "Invalid credentials" };
    }

    // 4. Create session
    const now = Date.now();
    const expiresAt = now + SESSION_DAYS * 24 * 60 * 60 * 1000;
    const jti = "jti_" + randomHex(12);
    const payload = {
      sub: user.id,
      typ: "owner",
      iat: Math.floor(now / 1000),
      exp: Math.floor(expiresAt / 1000),
      jti,
    };
    const token = await signJwt(payload, this.jwtSecret);
    const tokenHash = await hashString(token);

    await this.storage.execute(
      "INSERT INTO sessions (id, actor_id, token_hash, created_at, expires_at, revoked, user_agent, ip) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
      [jti, user.id, tokenHash, now, expiresAt, input.userAgent ?? null, input.ip ?? null]
    );

    return {
      ok: true,
      session: {
        token,
        actorId: user.id,
        actorType: "owner",
        issuedAt: now,
        expiresAt,
        userAgent: input.userAgent,
        ip: input.ip,
      },
    };
  }

  async logout(token: string): Promise<void> {
    const tokenHash = await hashString(token);
    await this.storage.execute(
      "UPDATE sessions SET revoked = 1 WHERE token_hash = ?",
      [tokenHash]
    );
  }

  async verifySession(token: string): Promise<Actor | null> {
    const payload = await verifyJwt(token, this.jwtSecret);
    if (!payload) return null;

    const tokenHash = await hashString(token);
    const session = await this.storage.queryOne<{ revoked: number; expires_at: number }>(
      "SELECT revoked, expires_at FROM sessions WHERE token_hash = ? LIMIT 1",
      [tokenHash]
    );
    if (!session || session.revoked || session.expires_at < Date.now()) return null;

    return {
      id: payload.sub,
      type: "owner",
      name: payload.sub,
      createdAt: payload.iat * 1000,
    };
  }

  async createApiToken(actorId: string, input: ApiTokenInput): Promise<ApiToken> {
    const now = Date.now();
    const days = input.expiresInDays ?? API_TOKEN_DAYS;
    const expiresAt = now + days * 24 * 60 * 60 * 1000;
    const raw = `rmt_${randomHex(32)}`;
    const tokenHash = await hashString(raw);
    const id = "tok_" + randomHex(12);

    await this.storage.execute(
      "INSERT INTO api_tokens (id, actor_id, name, token_hash, created_at, expires_at, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)",
      [id, actorId, input.name, tokenHash, now, expiresAt]
    );

    return {
      id,
      name: input.name,
      token: raw,
      createdAt: now,
      expiresAt,
    };
  }

  async verifyApiToken(token: string): Promise<Actor | null> {
    const tokenHash = await hashString(token);
    const row = await this.storage.queryOne<{
      id: string;
      actor_id: string;
      expires_at: number;
      revoked: number;
    }>(
      "SELECT id, actor_id, expires_at, revoked FROM api_tokens WHERE token_hash = ? LIMIT 1",
      [tokenHash]
    );
    if (!row || row.revoked || row.expires_at < Date.now()) return null;

    await this.storage.execute(
      "UPDATE api_tokens SET last_used_at = ? WHERE id = ?",
      [Date.now(), row.id]
    );

    return {
      id: row.actor_id,
      type: "api_token",
      name: row.id,
      createdAt: Date.now(),
    };
  }

  async revokeApiToken(tokenId: string): Promise<void> {
    await this.storage.execute(
      "UPDATE api_tokens SET revoked = 1 WHERE id = ?",
      [tokenId]
    );
  }

  async listApiTokens(actorId: string): Promise<Omit<ApiToken, "token">[]> {
    const rows = await this.storage.query<{
      id: string;
      name: string;
      created_at: number;
      expires_at: number;
      last_used_at: number | null;
    }>(
      "SELECT id, name, created_at, expires_at, last_used_at FROM api_tokens WHERE actor_id = ? AND revoked = 0 ORDER BY created_at DESC",
      [actorId]
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      lastUsedAt: r.last_used_at ?? undefined,
    }));
  }

  async changePassword(
    actorId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> {
    const user = await this.storage.queryOne<{
      password_hash: string;
      password_salt: string;
    }>(
      "SELECT password_hash, password_salt FROM users WHERE id = ? LIMIT 1",
      [actorId]
    );
    if (!user) return { ok: false, error: "User not found" };

    const ok = await verifyPassword(oldPassword, user.password_hash, user.password_salt);
    if (!ok) return { ok: false, error: "Old password is incorrect" };

    if (newPassword.length < 8) {
      return { ok: false, error: "New password must be at least 8 characters" };
    }

    const { hash, salt } = await hashPassword(newPassword);
    await this.storage.execute(
      "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
      [hash, salt, actorId]
    );

    // Revoke all sessions
    await this.storage.execute(
      "UPDATE sessions SET revoked = 1 WHERE actor_id = ?",
      [actorId]
    );

    return { ok: true };
  }

  async useRecoveryCode(
    username: string,
    code: string,
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> {
    if (newPassword.length < 8) {
      return { ok: false, error: "New password must be at least 8 characters" };
    }

    const user = await this.storage.queryOne<{ id: string }>(
      "SELECT id FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (!user) return { ok: false, error: "Invalid recovery code" };

    const codeHash = await hashString(code.toUpperCase().trim());
    const rc = await this.storage.queryOne<{ id: string }>(
      "SELECT id FROM recovery_codes WHERE actor_id = ? AND code_hash = ? AND used = 0 LIMIT 1",
      [user.id, codeHash]
    );
    if (!rc) return { ok: false, error: "Invalid recovery code" };

    await this.storage.execute(
      "UPDATE recovery_codes SET used = 1, used_at = ? WHERE id = ?",
      [Date.now(), rc.id]
    );

    const { hash, salt } = await hashPassword(newPassword);
    await this.storage.execute(
      "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
      [hash, salt, user.id]
    );

    await this.storage.execute(
      "UPDATE sessions SET revoked = 1 WHERE actor_id = ?",
      [user.id]
    );

    return { ok: true };
  }

  private async recordAttempt(ip: string, username: string | undefined, success: boolean): Promise<void> {
    await this.storage.execute(
      "INSERT INTO login_attempts (id, ip, username, success, created_at) VALUES (?, ?, ?, ?, ?)",
      ["la_" + randomHex(12), ip, username ?? null, success ? 1 : 0, Date.now()]
    );
  }
}

function randomHex(n: number): string {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
