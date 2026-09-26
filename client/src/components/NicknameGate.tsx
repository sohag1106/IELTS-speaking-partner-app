import { useState, type FormEvent } from 'react';
import { useIdentity } from '../state/IdentityContext';

export function NicknameGate() {
  const { login } = useIdentity();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(nickname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <form className="card" style={{ width: 'min(420px, 100%)' }} onSubmit={onSubmit}>
        <h1>Welcome</h1>
        <p className="muted">
          Pick a display name to start practicing IELTS Speaking. No password needed.
        </p>
        <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname"
            minLength={2}
            maxLength={24}
            autoFocus
            required
          />
          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={busy || nickname.trim().length < 2}>
            {busy ? 'Starting…' : 'Start practicing'}
          </button>
        </div>
      </form>
    </div>
  );
}
