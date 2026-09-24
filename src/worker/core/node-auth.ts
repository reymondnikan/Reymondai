// Constant-time comparison of node secrets.
// Both strings must be hex or any string of equal length.

export function verifyNodeSecret(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(provided);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
