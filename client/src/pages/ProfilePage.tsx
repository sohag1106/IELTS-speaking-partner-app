import { useEffect, useState } from 'react';
import { ProfileStats } from '../components/ProfileStats';
import { fetchProfile, type Profile } from '../lib/api';
import { useIdentity } from '../state/IdentityContext';

export function ProfilePage() {
  const { identity, ready } = useIdentity();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) return;
    fetchProfile(identity.token)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, [identity]);

  if (!ready) return null;
  if (!identity) {
    return (
      <div className="page">
        <div className="card">Set a nickname on the home page first.</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <div className="card error-text">{error}</div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="page">
        <div className="card muted">Loading…</div>
      </div>
    );
  }

  const { stats } = profile;

  return (
    <div className="page">
      <div className="card">
        <h1>{profile.nickname}</h1>
        <ProfileStats stats={stats} />
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Scores received</h2>
        {profile.received.length === 0 ? (
          <p className="muted">No tests yet — join a match to get your first score.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {profile.received.map((s, i) => (
              <li
                key={`${s.createdAt}-${i}`}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="muted">
                  Round {s.roundNumber} · by {s.examinerNickname} ·{' '}
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <strong>{s.band.toFixed(1)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Scores given as examiner</h2>
        {profile.given.length === 0 ? (
          <p className="muted">You haven't examined anyone yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {profile.given.map((s, i) => (
              <li
                key={`${s.createdAt}-${i}`}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span className="muted">
                  to {s.examineeNickname} · {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <strong>{s.band.toFixed(1)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
