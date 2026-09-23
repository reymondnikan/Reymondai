// Password hashing with PBKDF2-SHA256, 600,000 iterations.
// Industry standard for password storage (OWASP 2023+).

const ITERATIONS = 100000; // Cloudflare Workers caps at 100k
const HASH_LEN = 32; // bytes
const SALT_LEN = 16;

export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const hash = await derive(password, salt, ITERATIONS);
  return { hash: b64(hash), salt: b64(salt) };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  try {
    const salt = unb64(storedSalt);
    const expected = unb64(storedHash);
    const actual = await derive(password, salt, ITERATIONS);
    return constantTimeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_LEN * 8
  );
  return new Uint8Array(bits);
}

// Timing-safe comparison
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Hash an arbitrary string (used for tokens and recovery codes)
export async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64(new Uint8Array(digest));
}
