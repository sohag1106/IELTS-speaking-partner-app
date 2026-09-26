import { useState, type FormEvent } from 'react';
import { useMatch } from '../state/MatchContext';

export function LobbyPanel() {
  const { state, joinQueue, leaveQueue, createRoom, joinRoom } = useMatch();
  const [mode, setMode] = useState<'idle' | 'joining'>('idle');
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="lobby-state">
        <span>
          Share this code: <strong className="room-code">{pendingCode}</strong>{' '}
          <span className="muted">— waiting for your friend to join</span>
        </span>
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
      <div className="lobby-actions">
        <button type="button" onClick={onFindMatch} disabled={busy || !state.connected}>
          Find a random partner
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onCreateRoom}
          disabled={busy || !state.connected}
        >
          Create room code
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode('joining')}
          disabled={!state.connected}
        >
          Join with code
        </button>
      </div>
      {!state.connected && <p className="muted small">Connecting to server...</p>}
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
