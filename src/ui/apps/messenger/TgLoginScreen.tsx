import { useState } from "react";
import { tgManager, type TgSessionInfo } from "../../lib/telegram/client";

interface Props {
  onComplete: (info: TgSessionInfo) => void;
  onCancel: () => void;
}

type Step = "phone" | "code" | "password" | "loading";

export function TgLoginScreen({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep("loading");
    try {
      const { sessionId: sid } = await tgManager.startLogin(phone);
      setSessionId(sid);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("phone");
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setError(null);
    setStep("loading");
    try {
      const info = await tgManager.completeLogin(sessionId, code);
      onComplete(info);
    } catch (err) {
      const e2 = err as Error & { needs2FA?: boolean };
      if (e2.needs2FA) {
        setStep("password");
        return;
      }
      setError(e2.message);
      setStep("code");
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setError(null);
    setStep("loading");
    try {
      const info = await tgManager.completeLogin(sessionId, code, password);
      onComplete(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("password");
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="brand-dot" />
          <span>Telegram Login</span>
        </div>

        {step === "phone" && (
          <form className="auth-form" onSubmit={startLogin}>
            <div className="auth-subtitle">
              Enter your phone number (with country code)
            </div>
            <div className="auth-field">
              <label>Phone</label>
              <input
                type="tel"
                placeholder="+98 912 345 6789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" type="submit">
              Send code
            </button>
            <div className="auth-link" onClick={onCancel}>
              ← Cancel
            </div>
          </form>
        )}

        {step === "code" && (
          <form className="auth-form" onSubmit={submitCode}>
            <div className="auth-subtitle">
              We sent a code to your Telegram app.
              <br />
              Enter the code below.
            </div>
            <div className="auth-field">
              <label>Code</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" type="submit">
              Sign in
            </button>
          </form>
        )}

        {step === "password" && (
          <form className="auth-form" onSubmit={submitPassword}>
            <div className="auth-subtitle">
              Two-factor authentication is enabled.
              <br />
              Enter your Telegram password.
            </div>
            <div className="auth-field">
              <label>2FA Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-btn" type="submit">
              Confirm
            </button>
          </form>
        )}

        {step === "loading" && (
          <div className="auth-subtitle" style={{ padding: "20px 0" }}>
            Connecting to Telegram...
          </div>
        )}
      </div>
    </div>
  );
}
