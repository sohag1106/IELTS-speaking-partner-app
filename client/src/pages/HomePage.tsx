import { Link } from 'react-router-dom';
import { LobbyPanel } from '../components/LobbyPanel';
import { NicknameGate } from '../components/NicknameGate';
import { useIdentity } from '../state/IdentityContext';

export function HomePage() {
  const { identity, ready, logout } = useIdentity();
  if (!ready) return null;
  if (!identity) return <NicknameGate />;

  return (
    <div className="page">
      <div className="card">
        <h1>Hello, {identity.nickname} 👋</h1>
        <p className="muted">
          Match with a partner and take turns being examiner and examinee — or join a friend
          with a room code.
        </p>
        <LobbyPanel />
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
        <div className="row">
          <Link to="/profile">
            <button type="button" className="secondary">View my profile</button>
          </Link>
          <button type="button" className="secondary" onClick={logout}>
            Switch nickname
          </button>
        </div>
      </div>
    </div>
  );
}
