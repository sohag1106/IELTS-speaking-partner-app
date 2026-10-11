import type { ConnectionState } from '../hooks/useWebRTC';

export interface ControlDockProps {
  hasMedia: boolean;
  mic: boolean;
  cam: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEnable: () => void;
  enabling: boolean;
  connectionState: ConnectionState;
  peerMic: boolean;
  peerCam: boolean;
  onRetry: () => void;
  /** Bring the notes field into view (Part 2 prep). */
  onNotes?: () => void;
  onLeave: () => void;
}

const STATE_LABEL: Record<string, string> = {
  idle: 'A/V idle',
  new: 'Connecting…',
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Reconnecting…',
  failed: 'Connection failed',
  closed: 'Closed',
};

/**
 * Fixed bottom dock. Mic and camera are the two controls reached for
 * mid-sentence, so they get 54px round targets and a floor to sit on instead
 * of being the smallest chips in a wrapping row. Leave is deliberately
 * smaller and red — it should never be the easiest thing to hit.
 */
export function ControlDock({
  hasMedia,
  mic,
  cam,
  onToggleMic,
  onToggleCam,
  onEnable,
  enabling,
  connectionState,
  peerMic,
  peerCam,
  onRetry,
  onNotes,
  onLeave,
}: ControlDockProps) {
  const avOff = !hasMedia && !peerMic && !peerCam;
  const label = avOff
    ? 'A/V off — camera skipped'
    : (STATE_LABEL[connectionState] ?? connectionState);
  const chipClass =
    connectionState === 'connected'
      ? 'ok'
      : connectionState === 'failed'
        ? 'bad'
        : connectionState === 'idle'
          ? 'idle'
          : 'busy';

  return (
    <nav className="control-dock" aria-label="call controls">
      {hasMedia ? (
        <>
          <button
            type="button"
            className={`dock-btn${mic ? '' : ' off'}`}
            onClick={onToggleMic}
            aria-pressed={mic}
            aria-label={mic ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="dock-icon" aria-hidden="true">
              {mic ? '🎤' : '🔇'}
            </span>
            <span className="dock-label">Mic</span>
          </button>
          <button
            type="button"
            className={`dock-btn${cam ? '' : ' off'}`}
            onClick={onToggleCam}
            aria-pressed={cam}
            aria-label={cam ? 'Turn camera off' : 'Turn camera on'}
          >
            <span className="dock-icon" aria-hidden="true">
              {cam ? '📷' : '📵'}
            </span>
            <span className="dock-label">Cam</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          className="dock-btn"
          onClick={onEnable}
          disabled={enabling}
          aria-label="Enable camera and microphone"
        >
          <span className="dock-icon" aria-hidden="true">
            📷
          </span>
          <span className="dock-label">{enabling ? 'Starting' : 'Enable'}</span>
        </button>
      )}

      {onNotes && (
        <button type="button" className="dock-btn" onClick={onNotes} aria-label="Jump to notes">
          <span className="dock-icon" aria-hidden="true">
            📝
          </span>
          <span className="dock-label">Notes</span>
        </button>
      )}

      {connectionState === 'failed' && (
        <button type="button" className="dock-btn" onClick={onRetry} aria-label="Retry connection">
          <span className="dock-icon" aria-hidden="true">
            ↻
          </span>
          <span className="dock-label">Retry</span>
        </button>
      )}

      {/* The connection state is the one thing here that isn't a button. It
          keeps the .conn-chip class the e2e checks read. */}
      <span className={`conn-chip ${chipClass}`} title="connection state">
        {label}
      </span>

      <button type="button" className="dock-leave" onClick={onLeave}>
        Leave
      </button>
    </nav>
  );
}
