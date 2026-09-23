// Minimal JWT (HS256) — sign + verify. No dependencies.

export interface JwtPayload {
  sub: string;          // actor id
  typ: string;          // actor type
  iat: number;          // issued at (seconds)
  exp: number;          // expiration (seconds)
  jti: string;          // token id
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = b64url(JSON.stringify(header));
  const encodedPayload = b64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = await hmac(data, secret);
  return `${data}.${b64urlBytes(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;

    const data = `${h}.${p}`;
    const expectedSig = await hmac(data, secret);
    const actualSig = unb64url(s);
    if (!constantTimeEqual(expectedSig, actualSig)) return null;

    const payload = JSON.parse(unb64urlToString(p)) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

async function hmac(data: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function b64url(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlBytes(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function unb64urlToString(str: string): string {
  return new TextDecoder().decode(unb64url(str));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
