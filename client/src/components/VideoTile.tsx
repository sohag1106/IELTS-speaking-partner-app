import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface VideoTileProps {
  stream: MediaStream | null;
  /** Name / fallback text shown when there is no stream. */
  label: string;
  /** Self tiles stay muted to avoid echo; peer tiles start muted for autoplay. */
  muted: boolean;
  /** Mirror the local preview (front camera convention). */
  mirror?: boolean;
  /** Extra corner badges (mic-off, cam-off, …). */
  badges?: ReactNode;
  /** Overlay copy while waiting for the first stream. */
  placeholder?: string;
}

/**
 * One video surface. Autoplay-safe: attaches muted, then unmutes once
 * playback has started; if the browser still blocks, a tap overlay retries
 * under the user gesture (iOS Safari).
 */
export function VideoTile({ stream, label, muted, mirror, badges, placeholder }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.srcObject !== stream) {
      v.srcObject = stream;
      setBlocked(false);
    }
    if (!stream) return;

    // Muted-then-unmute: satisfies autoplay policies on desktop and mobile.
    v.muted = true;
    let cancelled = false;
    void v
      .play()
      .then(() => {
        if (cancelled) return;
        if (!muted) v.muted = false;
        setBlocked(false);
      })
      .catch(() => {
        if (!cancelled) setBlocked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [stream, muted]);

  // Any tap on the tile is a user gesture — retry playback + audio unlock.
  const onTap = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (!muted) v.muted = false;
    void v.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };

  return (
    <div className={`video-tile${mirror ? ' mirror' : ''}`} onPointerDown={onTap}>
      <video ref={videoRef} playsInline autoPlay muted className="video-el" />
      {!stream && (
        <div className="video-placeholder">
          <span className="video-placeholder-avatar" aria-hidden="true">
            {label.slice(0, 1).toUpperCase()}
          </span>
          <span>{placeholder ?? label}</span>
        </div>
      )}
      {blocked && stream && (
        <button type="button" className="video-unblock" onClick={onTap}>
          ▶ Tap to play
        </button>
      )}
      {badges && <div className="video-badges">{badges}</div>}
      <span className="video-label">{label}</span>
    </div>
  );
}
