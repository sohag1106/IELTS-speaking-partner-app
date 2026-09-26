import { Link } from 'react-router-dom';
import { LobbyPanel } from '../components/LobbyPanel';
import { NicknameGate } from '../components/NicknameGate';
import { useIdentity } from '../state/IdentityContext';

export function HomePage() {
  const { identity, ready, logout } = useIdentity();
  if (!ready) return null;
  if (!identity) return <NicknameGate />;

  return (
    <div className="page home-page">
      <section className="card hero">
        <span className="hero-kicker">1-on-1 · live video · real exam flow</span>
        <h1>Hello, {identity.nickname} 👋</h1>
        <p className="muted">
          Match with a partner and take turns being examiner and examinee — or join a friend
          with a room code.
        </p>
        <div className="feature-chips">
          <span className="chip">🎤 Live video call</span>
          <span className="chip">📝 Full Parts 1–3</span>
          <span className="chip">⏱ Timed cue card</span>
          <span className="chip">🎯 Band score out of 9</span>
        </div>
      </section>

      <section className="card home-lobby">
        <LobbyPanel />
        <hr />
        <div className="row home-actions">
          <Link to="/profile">
            <button type="button" className="secondary">View my profile</button>
          </Link>
          <button type="button" className="secondary" onClick={logout}>
            Switch nickname
          </button>
        </div>
      </section>
    </div>
  );
}
