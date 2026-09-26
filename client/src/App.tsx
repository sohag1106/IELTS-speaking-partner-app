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
  return (
    <header className="app-header">
      <Link to="/" className="brand">IELTS Speaking Partner</Link>
      <nav>
        <NavLink to="/">Lobby</NavLink>
        <NavLink to="/profile">Profile</NavLink>
        {identity && <span className="muted">{identity.nickname}</span>}
        <span className="muted" title="server connection">
          {state.connected ? '🟢' : '🔴'}
        </span>
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
