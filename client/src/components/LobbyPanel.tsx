import { useState, type FormEvent } from 'react';
import { useMatch } from '../state/MatchContext';

/**
 * Three ways into a match. "Find a partner" is promoted to a full-width
 * primary because finding someone is the actual intent; creating and joining
 * a room are the fallbacks and share a row beneath it.
 */
export function LobbyPanel() {
  const { state, joinQueue, leaveQueue, createRoom, joinRoom } = useMatch();
  const [mode, setMode] = useState<'idle' | 'joining'>('idle');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onFindMatch() {
    setError(null);
    setBusy(true);
    try {
      await joinQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start matching');
    } finally {
      setBusy(false);
    }
  }

  async function onCancelQueue() {
    await leaveQueue();
  }

  async function onCreateRoom() {
    setError(null);
    setBusy(true);
    try {
      const code = await createRoom();
      setPendingCode(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room');
    } finally {
      setBusy(false);
    }
  }

  async function onJoinCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await joinRoom(codeInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room');
    } finally {
      setBusy(false);
    }
  }

  /** A six-letter code is a well-built code; reading it aloud is the friction. */
  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (state.queueWaiting) {
    return (
      <div className="lobby-state">
        <span>
          <strong>Waiting for a partner...</strong>{' '}
          <span className="muted">one of you will be the examiner</span>
        </span>
        <button type="button" className="secondary" onClick={onCancelQueue}>
          Cancel
        </button>
      </div>
    );
  }

  if (pendingCode) {
    return (
      <div className="lobby-state code-state">
        <div>
          <p className="field-label">Share this code</p>
          <div className="code-row">
            <strong className="room-code">{pendingCode}</strong>
            <button type="button" className="secondary copy-btn" onClick={() => void copyCode(pendingCode)}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="muted small">Waiting for your friend to join.</p>
        </div>
        <button type="button" className="secondary" onClick={() => setPendingCode(null)}>
          Cancel
        </button>
      </div>
    );
  }

  if (mode === 'joining') {
    return (
      <form className="lobby-form" onSubmit={onJoinCode}>
        <div className="row">
          <input
            className="room-input"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ROOM CODE"
            maxLength={6}
            autoFocus
            required
          />
          <button type="submit" disabled={busy || codeInput.trim().length < 6}>
            Join
          </button>
          <button type="button" className="secondary" onClick={() => setMode('idle')}>
            Back
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    );
  }

  return (
    <div className="lobby-idle">
      <button
        type="button"
        className="cta lobby-primary"
        onClick={onFindMatch}
        disabled={busy || !state.connected}
      >
        <span className="cta-title">Find a partner</span>
        <span className="cta-sub">Random match · matched in about a minute</span>
      </button>

      <div className="lobby-pair">
        <button
          type="button"
          className="tap"
          onClick={onCreateRoom}
          disabled={busy || !state.connected}
        >
          <strong>Create a room</strong>
          <span>Share a 6-letter code</span>
        </button>
        <button
          type="button"
          className="tap"
          onClick={() => setMode('joining')}
          disabled={!state.connected}
        >
          <strong>Join a room</strong>
          <span>Enter a friend&apos;s code</span>
        </button>
      </div>

      {!state.connected && <p className="muted small">Connecting to server...</p>}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
