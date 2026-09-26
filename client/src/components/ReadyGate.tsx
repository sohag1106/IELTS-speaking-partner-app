import { useEffect, useRef, useState } from 'react';
import { examError } from '../lib/examErrors';
import type { UseMediaResult } from '../hooks/useMedia';
import { useMatch } from '../state/MatchContext';

interface ReadyGateProps {
  media: UseMediaResult;
}

/**
 * Round lobby. MatchPage requests the camera automatically and this gate
 * confirms readiness by itself once the stream exists, so the happy path
 * needs no click — buttons only appear as fallbacks when permission is
 * denied or the ready-ack fails.
 */
export function ReadyGate({ media }: ReadyGateProps) {
  const { state, markReady } = useMatch();
  const session = state.session;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const attemptedRef = useRef(0); // last round auto-confirmed (StrictMode-safe)

  const confirm = async (withMedia: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      if (withMedia && !media.stream) {
        const ok = await media.start();
        if (!ok) return; // media.error is shown; the fallback buttons stay up
      }
      await markReady();
    } catch (e) {
      setErr(examError(e));
    } finally {
      setBusy(false);
    }
  };

  const roundNumber = session?.roundNumber ?? 0;
  const hasSet = Boolean(session?.set);
  const youReady = Boolean(session?.youReady);
  const hasStream = Boolean(media.stream);

  // Auto-confirm readiness as soon as camera + question set are in place.
  useEffect(() => {
    if (!roundNumber || !hasSet || youReady || !hasStream) return;
    if (attemptedRef.current === roundNumber) return;
    attemptedRef.current = roundNumber;
    setBusy(true);
    setErr(null);
    markReady()
      .catch((e) => setErr(examError(e)))
      .finally(() => setBusy(false));
  }, [roundNumber, hasSet, youReady, hasStream, markReady]);

  if (!session) return null;

  const cameraFailed = !hasStream && !media.starting && Boolean(media.error);
  const failed = Boolean(err) || cameraFailed;

  return (
    <div className="card ready-gate">
      <h2>Round {session.roundNumber} of 2</h2>
      <p>
        This round you are the{' '}
        <span className={`role-tag ${session.role}`}>{session.role}</span> — roles swap after
        this test.
      </p>
      {session.set && <p className="muted">Topic set: {session.set.title}</p>}
      <hr />
      {session.youReady ? (
        <p className="ready-waiting">
          ✅ You&apos;re ready — waiting for <strong>{session.peer.nickname}</strong>...
        </p>
      ) : failed ? (
        <div className="gate-actions">
          <button
            type="button"
            onClick={() => void confirm(!hasStream)}
            disabled={busy || media.starting}
          >
            {busy || media.starting ? 'Starting...' : hasStream ? 'Try again' : 'Try camera again'}
          </button>
          {!hasStream && (
            <button
              type="button"
              className="secondary"
              onClick={() => void confirm(false)}
              disabled={busy}
            >
              Continue without camera
            </button>
          )}
        </div>
      ) : (
        <p className="ready-status">
          <span className="spinner" aria-hidden="true" />
          {media.starting
            ? 'Allow camera & microphone access when your browser asks…'
            : 'Getting you ready…'}
        </p>
      )}
      {cameraFailed && media.error && <p className="error-text">{media.error}</p>}
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}
