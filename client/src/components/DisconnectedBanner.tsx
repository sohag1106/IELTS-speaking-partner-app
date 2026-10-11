import { useNavigate } from 'react-router-dom';
import { useMatch } from '../state/MatchContext';

/** Shown when the peer disconnects or leaves before the match completes. */
export function DisconnectedBanner() {
  const { state, leaveMatch } = useMatch();
  const navigate = useNavigate();
  const session = state.session;
  if (!session) return null;

  return (
    <div className="card banner-danger">
      <h2>Match ended</h2>
      <p>
        {session.peerLeft
          ? `${session.peer.nickname} left the room.`
          : `${session.peer.nickname} disconnected.`}
      </p>
      <p className="muted">
        The match was closed without completing both rounds — any unfinished round was
        discarded.
      </p>
      {/* Same two doors, same place, as the completed-match ending. Both clear
          the match before navigating — MatchWatcher sends a live match back
          into /room, so a bare link would not actually leave. */}
      <div className="ending-actions">
        <button
          type="button"
          className="cta"
          onClick={() => {
            leaveMatch();
            navigate('/');
          }}
        >
          Back to lobby
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
