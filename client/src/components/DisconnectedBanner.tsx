import { useMatch } from '../state/MatchContext';

/** Shown when the peer disconnects or leaves before the match completes. */
export function DisconnectedBanner() {
  const { state, leaveMatch } = useMatch();
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
      <button type="button" onClick={leaveMatch}>
        Back to lobby
      </button>
    </div>
  );
}
