import { useState } from "react";
import { authApi } from "../lib/auth-api";

interface Props {
  onComplete: () => void;
}

export function SetupScreen({ onComplete }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.setup(username, password);
      setRecoveryCodes(result.recoveryCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    if (!recoveryCodes) return;
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
  };

  const downloadCodes = () => {
    if (!recoveryCodes) return;
    const text =
      "Raymond Recovery Codes\n" +
      "=====================\n\n" +
      "Keep these in a safe place.\n" +
      "Each code can only be used once.\n\n" +
      recoveryCodes.join("\n") + "\n";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raymond-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (recoveryCodes) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">
            <span className="brand-dot" />
            <span>Raymond</span>
          </div>
          <div className="auth-subtitle">Setup complete</div>

          <div className="recovery-title">⚠ Save these recovery codes now</div>
          <div className="recovery-codes">
            {recoveryCodes.map((code, i) => (
              <div key={i}>{code}</div>
            ))}
          </div>

          <div className="recovery-warning">
            These will NOT be shown again.
            <br />
            Without them, if you forget your password, you must reset the database.
          </div>

          <button
            className="auth-btn"
            style={{ marginTop: 16 }}
            onClick={copyAll}
          >
            Copy all codes
          </button>

          <button
            className="auth-btn"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            onClick={downloadCodes}
          >
            Download as file
          </button>

          <div
            className="auth-link"
            onClick={onComplete}
          >
            I saved them — continue to login
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-dot" />
          <span>Raymond</span>
        </div>
        <div className="auth-subtitle">First-time setup</div>

        <form className="auth-form" onSubmit={submit}>
          <div className="auth-field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="auth-field">
            <label>Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <div className="auth-hint">
          This account is stored locally. There is no password recovery
          by email. You will get recovery codes on the next screen.
        </div>
      </div>
    </div>
  );
}
