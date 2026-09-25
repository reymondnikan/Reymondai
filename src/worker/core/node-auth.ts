// Node secret verification with multi-node support.
//
// NODE_SECRETS is a JSON map: {"nodeId": "secret", ...}
// Falls back to a single NODE_SECRET for backward compat.

export function verifyNodeSecret(
  secretsEnv: string | undefined,
  singleSecretEnv: string | undefined,
  nodeId: string,
  provided: string
): boolean {
  if (!provided) return false;

  // Try multi-node map first
  if (secretsEnv) {
    try {
      const map = JSON.parse(secretsEnv) as Record<string, string>;
      const expected = map[nodeId];
      if (expected && constantTimeEqual(expected, provided)) {
        return true;
      }
    } catch {
      // ignore parse errors
    }
  }

  // Fallback to single secret
  if (singleSecretEnv) {
    if (constantTimeEqual(singleSecretEnv, provided)) return true;
  }

  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
