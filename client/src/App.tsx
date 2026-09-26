import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { MatchWatcher } from './components/MatchWatcher';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { MatchPage } from './pages/MatchPage';
import { IdentityProvider, useIdentity } from './state/IdentityContext';
import { MatchProvider, useMatch } from './state/MatchContext';

function Header() {
  const { identity } = useIdentity();
  const { state } = useMatch();
  // The header must not stay sticky during a match — the video column pins
  // to the top:0 edge, and an overlapping bar would cover the peer's face.
  const inMatch = Boolean(state.session);
  return (
    <header className={`app-header${inMatch ? ' in-match' : ''}`}>
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          🎤
        </span>
        <span className="brand-text">IELTS Speaking Partner</span>
      </Link>
      <nav>
        <NavLink to="/" end>
          Lobby
        </NavLink>
        <NavLink to="/profile">Profile</NavLink>
        {identity && <span className="nick-chip">{identity.nickname}</span>}
        <span
          className={`socket-dot${state.connected ? ' on' : ''}`}
          role="img"
          aria-label={state.connected ? 'server connected' : 'server disconnected'}
          title="server connection"
        />
      </nav>
    </header>
  );
}

function Shell() {
  return (
    <div className="app-shell">
      <Header />
      <MatchWatcher />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/room/:matchId" element={<MatchPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <IdentityProvider>
      <MatchProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </MatchProvider>
    </IdentityProvider>
  );
}
