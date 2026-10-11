import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProfileStats } from '../components/ProfileStats';
import { fetchProfile, type Profile } from '../lib/api';
import { useIdentity } from '../state/IdentityContext';

type Tab = 'received' | 'given';

export function ProfilePage() {
  const { identity, ready } = useIdentity();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Two stacked lists made you scroll past one to reach the other; they are
  // two views of the same thing, so they share one card behind a toggle.
  const [tab, setTab] = useState<Tab>('received');

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
        <div className="card muted">Loading...</div>
      </div>
    );
  }

  const { stats } = profile;
  const initial = profile.nickname.trim().slice(0, 1).toUpperCase() || '?';
  const received = profile.received;
  const given = profile.given;
  const showing = tab === 'received' ? received : given;
  const empty =
    tab === 'received'
      ? 'No tests yet — join a match to get your first score.'
      : "You haven't examined anyone yet.";

  return (
    <div className="page profile-page">
      <div className="card profile-hero">
        <div className="avatar-lg" aria-hidden="true">
          {initial}
        </div>
        <div>
          <h1>{profile.nickname}</h1>
          <p className="muted small">Guest practice account — scores follow this nickname.</p>
        </div>
      </div>

      <div className="card">
        <ProfileStats stats={stats} />
      </div>

      <div className="card">
        <div className="seg" role="tablist" aria-label="Score history">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'received'}
            className={`seg-btn${tab === 'received' ? ' on' : ''}`}
            onClick={() => setTab('received')}
          >
            Received <span className="seg-count">{received.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'given'}
            className={`seg-btn${tab === 'given' ? ' on' : ''}`}
            onClick={() => setTab('given')}
          >
            Given <span className="seg-count">{given.length}</span>
          </button>
        </div>

        {showing.length === 0 ? (
          <p className="muted">{empty}</p>
        ) : (
          <ul className="score-list">
            {tab === 'received'
              ? received.map((s, i) => (
                  <li key={`${s.createdAt}-${i}`}>
                    <span className="muted">
                      Round {s.roundNumber} · by {s.examinerNickname} ·{' '}
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    <strong className="score-num">{s.band.toFixed(1)}</strong>
                  </li>
                ))
              : given.map((s, i) => (
                  <li key={`${s.createdAt}-${i}`}>
                    <span className="muted">
                      to {s.examineeNickname} · {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                    <strong className="score-num">{s.band.toFixed(1)}</strong>
                  </li>
                ))}
          </ul>
        )}

        <p className="muted small">
          These bands come from other learners you practised with — not a teacher or an
          official examiner.
        </p>
      </div>

      <Link className="cta secondary" to="/">
        Back to lobby
      </Link>
    </div>
  );
}