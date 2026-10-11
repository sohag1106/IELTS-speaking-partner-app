import { useState, type FormEvent } from 'react';
import { useIdentity } from '../state/IdentityContext';

/**
 * First launch. The only screen a new user ever sees alone, so it carries the
 * whole pitch. No autofocus: on Android the keyboard would cover the headline
 * before it has been read.
 */
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

  const tooShort = nickname.trim().length < 2;

  return (
    <div className="center-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div className="auth-badge" aria-hidden="true">
          🎤
        </div>
        <h1>Practice IELTS Speaking</h1>
        <p className="muted">
          One-to-one video, the real three parts, and a band out of 9. No password — just a
          name.
        </p>

        <div className="stack auth-fields">
          <label className="field-label" htmlFor="display-name">
            Display name
          </label>
          <input
            id="display-name"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your nickname"
            minLength={2}
            maxLength={24}
            inputMode="text"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            required
          />
          <p className="field-hint">2–24 characters. Shows next to your scores.</p>
          {error && (
            <div className="notif bad" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}
          <button type="submit" className="cta" disabled={busy || tooShort}>
            {busy ? 'Starting…' : 'Start practising →'}
          </button>
          <p className="field-hint centered">
            You&apos;ll be asked for camera and microphone access before your first match.
          </p>
        </div>
      </form>
    </div>
  );
}
