import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, type Profile } from '../lib/api';
import { useIdentity } from '../state/IdentityContext';
import { useMatch } from '../state/MatchContext';

/**
 * Post-match summary: the band you were given leads, then the rounds, then the
 * running average the profile keeps. The average is read fresh from /api/me
 * because the server saves the band as the match closes — it is the number the
 * learner actually wants to see move, and it is not in the socket state.
 */
export function ResultsView() {
  const { state, leaveMatch } = useMatch();
  const navigate = useNavigate();
  const { identity } = useIdentity();
  const session = state.session;
  const [profile, setProfile] = useState<Profile | null>(null);
  const token = identity?.token;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchProfile(token)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // The match result below is the important part; the record can fail.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!session) return null;

  const rounds = [...session.scores].sort((a, b) => a.roundNumber - b.roundNumber);
  const myBand = identity
    ? rounds.find((r) => r.examineeId === identity.userId)?.band
    : undefined;

  return (
    <div className="card results-view">
      <h2>Match complete</h2>

      {myBand !== undefined ? (
        <div className="band-hero">
          <span className="band-hero-value">{myBand.toFixed(1)}</span>
          <span className="band-hero-label">
            your band this match, from {session.peer.nickname}
          </span>
        </div>
      ) : (
        <p className="muted">
          You examined <strong className="peer-name">{session.peer.nickname}</strong> this
          match.
        </p>
      )}

      {profile && profile.stats.count > 0 && (
        <p className="record-line">
          Average <strong>{profile.stats.avgBand?.toFixed(1) ?? '—'}</strong> across{' '}
          {profile.stats.count} {profile.stats.count === 1 ? 'test' : 'tests'}
        </p>
      )}

      <ul className="results-list">
        {rounds.map((r) => (
          <li key={r.roundNumber}>
            <span className="results-round">Round {r.roundNumber}</span>
            <span>
              {identity && r.examineeId === identity.userId ? (
                <>
                  You were examined — band <strong>{r.band.toFixed(1)}</strong>
                </>
              ) : (
                <>
                  You examined {session.peer.nickname} — band given{' '}
                  <strong>{r.band.toFixed(1)}</strong>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="muted small">Bands on your record come from other learners, not a teacher.</p>

      {/* Both endings (here and the disconnect banner) offer the same two doors
          in the same place. They go through leaveMatch, not a bare <Link>:
          MatchWatcher re-enters the room whenever a match is still live, so a
          plain link would bounce the learner straight back to this screen. */}
      <div className="ending-actions">
        <button
          type="button"
          className="cta"
          onClick={() => {
            leaveMatch();
            navigate('/');
          }}
        >
          Find another partner
        </button>
        <button
          type="button"
          className="cta secondary"
          onClick={() => {
            leaveMatch();
            navigate('/profile');
          }}
        >
          See your record
        </button>
      </div>
    </div>
  );
}
