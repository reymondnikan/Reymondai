import { useState } from "react";
import { authApi } from "../lib/auth-api";

interface Props {
  onComplete: () => void;
}

export function LoginScreen({ onComplete }: Props) {
  const [mode, setMode] = useState<"login" | "recover">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await authApi.login(username, password);
        onComplete();
      } else {
        const res = await authApi.recover(username, code, newPassword);
        setInfo(res.message);
        setMode("login");
        setPassword("");
        setCode("");
        setNewPassword("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-dot" />
          <span>Raymond</span>
        </div>
        <div className="auth-subtitle">
          {mode === "login" ? "Sign in to continue" : "Reset with recovery code"}
        </div>

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

          {mode === "login" ? (
            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          ) : (
            <>
              <div className="auth-field">
                <label>Recovery code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="RAY-XXXX-XXXX-XXXX"
                  required
                />
              </div>
              <div className="auth-field">
                <label>New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </>
          )}

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Sign in"
              : "Reset password"}
          </button>
        </form>

        {mode === "login" ? (
          <div className="auth-link" onClick={() => setMode("recover")}>
            Forgot password? Use a recovery code
          </div>
        ) : (
          <div className="auth-link" onClick={() => setMode("login")}>
            ← Back to sign in
          </div>
        )}
      </div>
    </div>
  );
}
