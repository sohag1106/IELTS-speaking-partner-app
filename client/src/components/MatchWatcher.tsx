import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMatch } from '../state/MatchContext';

/**
 * Navigates into the room when a match starts, and back out when it's over.
 * Rendered inside the Router.
 */
export function MatchWatcher() {
  const { state, leaveMatch } = useMatch();
  const navigate = useNavigate();
  const location = useLocation();

  const matchId = state.session?.matchId ?? null;

  useEffect(() => {
    if (matchId && !location.pathname.startsWith(`/room/`)) {
      navigate(`/room/${matchId}`, { replace: true });
    }
  }, [matchId, location.pathname, navigate]);

  // When the session clears while sitting in /room, go home.
  useEffect(() => {
    if (!matchId && location.pathname.startsWith('/room/')) {
      leaveMatch();
      navigate('/', { replace: true });
    }
    // leaveMatch intentionally omitted: stable-enough via context value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, location.pathname]);

  return null;
}
