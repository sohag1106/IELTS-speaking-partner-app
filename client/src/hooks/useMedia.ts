import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMediaResult {
  /** Local camera+mic stream, or null before the user grants access. */
  stream: MediaStream | null;
  mic: boolean;
  cam: boolean;
  /** True while getUserMedia is in flight. */
  starting: boolean;
  /** Friendly error message when permission is denied / no device exists. */
  error: string | null;
  /** Gesture-gated start: call from a button click. Resolves to success. */
  start: () => Promise<boolean>;
  toggleMic: () => void;
  toggleCam: () => void;
}

/**
 * Local media capture. Starts only on an explicit gesture (`start()`), so it
 * satisfies mobile autoplay/permission policies — ReadyGate's "Enable camera"
 * button is the gesture.
 */
export function useMedia(): UseMediaResult {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    setStarting(true);
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = s;
      setStream(s);
      setMic(true);
      setCam(true);
      return true;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Camera/microphone permission was denied. Allow access in your browser and try again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No camera or microphone found on this device.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setError('Your camera or mic is already in use by another app.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not start camera/microphone.');
      }
      return false;
    } finally {
      setStarting(false);
    }
  }, []);

  const toggleMic = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !s.getAudioTracks()[0]?.enabled;
    for (const t of s.getAudioTracks()) t.enabled = next;
    setMic(next);
  }, []);

  const toggleCam = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    const next = !s.getVideoTracks()[0]?.enabled;
    for (const t of s.getVideoTracks()) t.enabled = next;
    setCam(next);
  }, []);

  // Release the camera when the match page unmounts.
  useEffect(() => {
    return () => {
      const s = streamRef.current;
      streamRef.current = null;
      if (s) for (const t of s.getTracks()) t.stop();
    };
  }, []);

  return { stream, mic, cam, starting, error, start, toggleMic, toggleCam };
}
