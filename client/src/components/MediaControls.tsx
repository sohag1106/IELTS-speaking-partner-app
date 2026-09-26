import type { ConnectionState } from '../hooks/useWebRTC';

export interface MediaControlsProps {
  hasMedia: boolean;
  mic: boolean;
  cam: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  /** When the user skipped the camera, offer a mid-match way back in. */
  onEnable: () => void;
  enabling: boolean;
  connectionState: ConnectionState;
  peerMic: boolean;
  peerCam: boolean;
  onRetry: () => void;
  /** getUserMedia failure surfaced from a mid-match enable attempt. */
  error?: string | null;
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

export function MediaControls({
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
  error,
}: MediaControlsProps) {
  const avOff = !hasMedia && !peerMic && !peerCam;
  const label = avOff ? 'A/V off — camera skipped' : (STATE_LABEL[connectionState] ?? connectionState);
  const chipClass =
    connectionState === 'connected'
      ? 'ok'
      : connectionState === 'failed'
        ? 'bad'
        : connectionState === 'idle'
          ? 'idle'
          : 'busy';

  return (
    <div className="media-controls">
      {hasMedia ? (
        <>
          <button
            type="button"
            className={`ctl${mic ? '' : ' off'}`}
            onClick={onToggleMic}
            aria-pressed={mic}
            title={mic ? 'Mute microphone' : 'Unmute microphone'}
          >
            {mic ? '🎤 Mic on' : '🔇 Mic off'}
          </button>
          <button
            type="button"
            className={`ctl${cam ? '' : ' off'}`}
            onClick={onToggleCam}
            aria-pressed={cam}
            title={cam ? 'Turn camera off' : 'Turn camera on'}
          >
            {cam ? '📷 Cam on' : '📵 Cam off'}
          </button>
        </>
      ) : (
        <button type="button" className="ctl" onClick={onEnable} disabled={enabling}>
          {enabling ? 'Starting…' : '📷 Enable camera & mic'}
        </button>
      )}
      <span className={`conn-chip ${chipClass}`}>{label}</span>
      {connectionState === 'failed' && (
        <button type="button" className="ctl" onClick={onRetry}>
          ↻ Retry
        </button>
      )}
      {error && <p className="error-text media-error">{error}</p>}
    </div>
  );
}
