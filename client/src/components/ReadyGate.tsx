import { useState } from 'react';
import { examError } from '../lib/examErrors';
import type { UseMediaResult } from '../hooks/useMedia';
import { useMatch } from '../state/MatchContext';

interface ReadyGateProps {
  media: UseMediaResult;
}

/** Both players confirm before each round begins (camera gate is the gesture). */
export function ReadyGate({ media }: ReadyGateProps) {
  const { state, markReady } = useMatch();
  const session = state.session;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mediaFailed, setMediaFailed] = useState(false);

  if (!session) return null;

  const confirm = async (withMedia: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      if (withMedia && !media.stream) {
        const ok = await media.start();
        if (!ok) {
          setMediaFailed(true);
          return;
        }
      }
      await markReady();
    } catch (e) {
      setErr(examError(e));
    } finally {
      setBusy(false);
    }
  };

  const mediaError = mediaFailed ? media.error : null;

  return (
    <div className="card ready-gate">
      <h2>
        Round {session.roundNumber} of 2
      </h2>
      <p>
        This round you are the{' '}
        <span className={`role-tag ${session.role}`}>{session.role}</span>{' '}
        — roles swap after this test.
      </p>
      {session.set && <p className="muted">Topic set: {session.set.title}</p>}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
      {session.youReady ? (
        <p className="ready-waiting">
          ✅ You&apos;re ready — waiting for <strong>{session.peer.nickname}</strong>...
        </p>
      ) : media.stream ? (
        <button type="button" onClick={() => void confirm(false)} disabled={busy || !session.set}>
          {busy ? 'Confirming...' : "I'm ready"}
        </button>
      ) : mediaFailed ? (
        <>
          <button
            type="button"
            onClick={() => void confirm(false)}
            disabled={busy || !session.set}
          >
            {busy ? 'Confirming...' : "I'm ready without camera"}
          </button>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            You can enable the camera later from the controls under the video.
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void confirm(true)}
          disabled={busy || media.starting || !session.set}
        >
          {busy || media.starting ? 'Starting camera...' : 'Enable camera & mic — I\'m ready'}
        </button>
      )}
      {mediaError && <p className="error-text">{mediaError}</p>}
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}
