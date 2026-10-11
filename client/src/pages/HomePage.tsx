import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LobbyPanel } from '../components/LobbyPanel';
import { NicknameGate } from '../components/NicknameGate';
import { fetchProfile, type Profile } from '../lib/api';
import { useIdentity } from '../state/IdentityContext';

export function HomePage() {
  const { identity, ready, logout } = useIdentity();
  const [profile, setProfile] = useState<Profile | null>(null);

  // The record rides on the lobby because the number people are here to move
  // shouldn't be one navigation away.
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    fetchProfile(identity.token)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // Not worth surfacing: the lobby still works without the record.
      });
    return () => {
      cancelled = true;
    };
  }, [identity]);

  if (!ready) return null;
  if (!identity) return <NicknameGate />;

  const initial = identity.nickname.trim().slice(0, 1).toUpperCase() || '?';
  const stats = profile?.stats;

  return (
    <div className="page home-page">
      <section className="app-bar">
        <span className="avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="app-bar-name">{identity.nickname}</span>
      </section>

      <section className="card home-lobby">
        <LobbyPanel />
      </section>

      <section className="card flat before-start">
        <span className="section-label">Before you start</span>
        <span className="check">
          <i className="y" aria-hidden="true">
            ✓
          </i>
          Camera &amp; microphone — asked at match time
        </span>
        <span className="check">
          <i className="n" aria-hidden="true">
            2
          </i>
          Quiet room, phone on a stand
        </span>
        <span className="check">
          <i className="n" aria-hidden="true">
            3
          </i>
          Paper and pen for Part 2 notes
        </span>
      </section>

      <section className="card flat your-record">
        <div className="row between">
          <span className="section-label">Your record</span>
          <Link to="/profile" className="record-link">
            Profile →
          </Link>
        </div>
        {stats && stats.count > 0 ? (
          <div className="record-figures">
            <span>
              <b>{stats.count}</b> <span className="muted small">tests</span>
            </span>
            <span>
              <b className="accent">
                {stats.avgBand === null ? '—' : stats.avgBand.toFixed(1)}
              </b>{' '}
              <span className="muted small">average</span>
            </span>
          </div>
        ) : (
          <p className="muted small">
            No tests yet — join a match to get your first band.
          </p>
        )}
      </section>

      <section className="card home-actions-card">
        <div className="row home-actions">
          <Link to="/profile">
            <button type="button" className="secondary">
              View my profile
            </button>
          </Link>
          <button type="button" className="secondary" onClick={logout}>
            Switch nickname
          </button>
        </div>
      </section>
    </div>
  );
}
