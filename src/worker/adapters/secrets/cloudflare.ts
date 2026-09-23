// Secrets implementation backed by:
//   - System secrets: passed via env (wrangler secret / vars)
//   - User secrets: encrypted with AES-GCM, stored in D1 (user_secrets table)
//
// The encryption key is derived from RAYMOND_MASTER_KEY using PBKDF2.

import type { SecretsContract, StorageContract } from "../../core/contracts";

export class CloudflareSecrets implements SecretsContract {
  private encKey: CryptoKey | null = null;

  constructor(
    private envRecord: Record<string, unknown>,
    private storage: StorageContract,
    private masterSecret: string
  ) {}

  async getSystem(key: string): Promise<string | null> {
    const v = this.envRecord[key];
    if (typeof v === "string" && v.length > 0) return v;
    return null;
  }

  private async getEncKey(): Promise<CryptoKey> {
    if (this.encKey) return this.encKey;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(this.masterSecret),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    this.encKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode("raymond-vault-v1"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return this.encKey;
  }

  async get(key: string): Promise<string | null> {
    const row = await this.storage.queryOne<{ value: string; iv: string }>(
      "SELECT value, iv FROM user_secrets WHERE key = ? LIMIT 1",
      [key]
    );
    if (!row) return null;
    try {
      const keyObj = await this.getEncKey();
      const iv = b64decode(row.iv);
      const data = b64decode(row.value);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        keyObj,
        data
      );
      return new TextDecoder().decode(plain);
    } catch (err) {
      console.error("Failed to decrypt secret", key, err);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const keyObj = await this.getEncKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      keyObj,
      new TextEncoder().encode(value)
    );
    const ivB64 = b64encode(iv);
    const cipherB64 = b64encode(new Uint8Array(cipher));

    const existing = await this.storage.queryOne<{ key: string }>(
      "SELECT key FROM user_secrets WHERE key = ? LIMIT 1",
      [key]
    );
    if (existing) {
      await this.storage.execute(
        "UPDATE user_secrets SET value = ?, iv = ?, updated_at = ? WHERE key = ?",
        [cipherB64, ivB64, Date.now(), key]
      );
    } else {
      await this.storage.execute(
        "INSERT INTO user_secrets (key, value, iv, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [key, cipherB64, ivB64, Date.now(), Date.now()]
      );
    }
  }

  async delete(key: string): Promise<void> {
    await this.storage.execute("DELETE FROM user_secrets WHERE key = ?", [key]);
  }

  async list(): Promise<string[]> {
    const rows = await this.storage.query<{ key: string }>(
      "SELECT key FROM user_secrets ORDER BY key"
    );
    return rows.map((r) => r.key);
  }
}

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
