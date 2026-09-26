import { useIdentity } from '../state/IdentityContext';
import { useMatch } from '../state/MatchContext';

/** Post-match summary: both rounds' bands, then back to the lobby. */
export function ResultsView() {
  const { state, leaveMatch } = useMatch();
  const { identity } = useIdentity();
  const session = state.session;
  if (!session) return null;

  const rounds = [...session.scores].sort((a, b) => a.roundNumber - b.roundNumber);
  const myBand = identity
    ? rounds.find((r) => r.examineeId === identity.userId)?.band
    : undefined;

  return (
    <div className="card results-view">
      <h2>Match complete 🎉</h2>
      <p className="muted">
        You and <strong style={{ color: 'var(--text)' }}>{session.peer.nickname}</strong> both
        took a turn as examiner and examinee.
      </p>
      <ul className="results-list">
        {rounds.map((r) => (
          <li key={r.roundNumber}>
            <span className="results-round">Round {r.roundNumber}</span>
            <span>
              {identity && r.examineeId === identity.userId ? (
                <>
                  You were examined — your band <strong>{r.band.toFixed(1)}</strong>
                </>
              ) : (
                <>
                  You examined your partner — band given{' '}
                  <strong>{r.band.toFixed(1)}</strong>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      {myBand !== undefined && (
        <p>
          Your band this match: <strong className="band-big">{myBand.toFixed(1)}</strong>
        </p>
      )}
      <p className="muted small">Saved bands now show on your profile average.</p>
      <button type="button" onClick={leaveMatch}>
        Back to lobby
      </button>
    </div>
  );
}
