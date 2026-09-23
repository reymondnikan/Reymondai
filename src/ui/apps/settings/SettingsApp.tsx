export function SettingsApp() {
  return (
    <div className="settings-app">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>Rules Engine</h3>
        <p className="settings-hint">
          Rules are not implemented yet. Coming in v0.3.
        </p>
        <p className="settings-hint">
          You will be able to write:
        </p>
        <ul className="settings-list">
          <li>"When I ask for code, use DeepSeek Coder"</li>
          <li>"Never send customer data to external AI"</li>
          <li>"Always reply in Persian"</li>
        </ul>
      </div>

      <div className="settings-section">
        <h3>Local AI</h3>
        <p className="settings-hint">
          Connect an Ollama server to use local models.
          Add OLLAMA_URL as a secret and restart.
        </p>
      </div>

      <div className="settings-section">
        <h3>Security</h3>
        <ul className="settings-list">
          <li>Password: PBKDF2-SHA256 (100,000 rounds)</li>
          <li>Sessions: HS256 JWT, 30-day expiry</li>
          <li>Login limit: 5 attempts / 15 min per IP</li>
          <li>Recovery codes: 10 one-time codes</li>
        </ul>
      </div>

      <div className="settings-section">
        <h3>About</h3>
        <div className="settings-kv"><span>Version</span><span>0.2.0</span></div>
        <div className="settings-kv"><span>Runtime</span><span>Cloudflare Workers</span></div>
        <div className="settings-kv"><span>Storage</span><span>D1</span></div>
        <div className="settings-kv"><span>AI Providers</span><span>Workers AI, OpenRouter, Ollama</span></div>
      </div>
    </div>
  );
}
