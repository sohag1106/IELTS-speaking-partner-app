import type { ConnectionState } from '../hooks/useWebRTC';
import { VideoTile } from './VideoTile';

export interface VideoStageProps {
  peerStream: MediaStream | null;
  selfStream: MediaStream | null;
  peerName: string;
  peerMic: boolean;
  peerCam: boolean;
  selfCam: boolean;
  hasMedia: boolean;
  connectionState: ConnectionState;
  mediaError?: string | null;
}

/**
 * Side-by-side (desktop) / stacked (portrait) stage: peer fills the frame,
 * self-view floats picture-in-picture. Always rendered while the match is
 * live so remote audio keeps playing. The controls live in the persistent
 * ControlDock, not here — they need to survive this column being hidden.
 */
export function VideoStage({
  peerStream,
  selfStream,
  peerName,
  peerMic,
  peerCam,
  selfCam,
  hasMedia,
  connectionState,
  mediaError,
}: VideoStageProps) {
  return (
    <div className="video-stage">
      <div className="video-main">
        <VideoTile
          key="peer"
          stream={peerStream}
          label={peerName}
          muted={false}
          placeholder={peerStream ? 'Camera off' : `Waiting for ${peerName}…`}
          badges={
            <>
              {!peerCam && <span className="badge warn">📵 cam off</span>}
              {!peerMic && <span className="badge warn">🔇 mic off</span>}
            </>
          }
        />
        <div className="video-self">
          <VideoTile
            key="self"
            stream={selfStream}
            label="You"
            muted
            mirror
            placeholder="Camera off"
            badges={
              hasMedia && !selfCam ? <span className="badge warn">📵</span> : undefined
            }
          />
        </div>
      </div>
      {mediaError && <p className="error-text media-error">{mediaError}</p>}
      {/* Kept so the e2e checks that read call state off the stage still work. */}
      <span className="sr-only" aria-live="polite">
        {connectionState === 'connected' ? 'Connected' : 'Connecting'}
      </span>
    </div>
  );
}
