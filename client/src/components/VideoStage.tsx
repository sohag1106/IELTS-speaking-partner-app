import type { ConnectionState } from '../hooks/useWebRTC';
import { MediaControls } from './MediaControls';
import { VideoTile } from './VideoTile';

export interface VideoStageProps {
  peerStream: MediaStream | null;
  selfStream: MediaStream | null;
  peerName: string;
  peerMic: boolean;
  peerCam: boolean;
  selfMic: boolean;
  selfCam: boolean;
  hasMedia: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEnable: () => void;
  enabling: boolean;
  connectionState: ConnectionState;
  onRetry: () => void;
  mediaError?: string | null;
}

/**
 * Side-by-side (desktop) / stacked (portrait) stage: peer fills the frame,
 * self-view floats picture-in-picture. Always rendered while the match is
 * live so remote audio keeps playing.
 */
export function VideoStage({
  peerStream,
  selfStream,
  peerName,
  peerMic,
  peerCam,
  selfMic,
  selfCam,
  hasMedia,
  onToggleMic,
  onToggleCam,
  onEnable,
  enabling,
  connectionState,
  onRetry,
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
      <MediaControls
        hasMedia={hasMedia}
        mic={selfMic}
        cam={selfCam}
        onToggleMic={onToggleMic}
        onToggleCam={onToggleCam}
        onEnable={onEnable}
        enabling={enabling}
        connectionState={connectionState}
        peerMic={peerMic}
        peerCam={peerCam}
        onRetry={onRetry}
        error={mediaError}
      />
    </div>
  );
}
