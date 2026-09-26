import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  C2S,
  S2C,
  type WebRTCDescriptionPayload,
  type WebRTCIcePayload,
} from '../lib/events';
import { getIceConfig } from '../lib/iceConfig';

export interface UseWebRTCParams {
  /** Match is live (session up, not completed, peer not gone). */
  active: boolean;
  /** Round-1 examiner sends the initial offer (plan: examiner-only offer). */
  isCaller: boolean;
  localStream: MediaStream | null;
  socket: Socket | null;
}

export type ConnectionState = 'idle' | RTCPeerConnectionState;

export interface UseWebRTCResult {
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
  /** Full teardown + rebuild of the peer connection (failed-state retry). */
  retry: () => void;
}

type BufferedSignal =
  | { kind: 'offer'; description: RTCSessionDescriptionInit }
  | { kind: 'answer'; description: RTCSessionDescriptionInit }
  | { kind: 'ice'; candidate: RTCIceCandidateInit | null };

/** Examinee fallback: if the caller never sends its initial offer, offer anyway. */
const OFFER_FALLBACK_MS = 1500;
const MAX_ICE_RESTARTS = 3;

/**
 * One RTCPeerConnection per match, surviving the round-2 role swap.
 *
 * Negotiation uses the "perfect negotiation" pattern: the round-1 examiner is
 * the impolite peer (wins glare), the examinee is polite (rolls back). The
 * examinee additionally withholds its first offer until the caller's arrives
 * (with a fallback timer) so the plan's examiner-only initial offer holds in
 * the normal path but can never deadlock.
 */
export function useWebRTC({
  active,
  isCaller,
  localStream,
  socket,
}: UseWebRTCParams): UseWebRTCResult {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  // Bumped to force a full peer-connection rebuild (retry button).
  const [buildId, setBuildId] = useState(0);
  // Bumped whenever a new pc exists so the track effect re-runs.
  const [pcEpoch, setPcEpoch] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingIceRef = useRef<(RTCIceCandidateInit | null)[]>([]);
  const earlySignalsRef = useRef<BufferedSignal[]>([]);
  const fallbackTimerRef = useRef<number | null>(null);
  const restartsRef = useRef(0);
  const remoteMediaRef = useRef<MediaStream | null>(null);

  // Latest values for async callbacks (assigned during render).
  const isCallerRef = useRef(isCaller);
  isCallerRef.current = isCaller;
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;

  useEffect(() => {
    if (!active || !socket) return;
    let disposed = false;

    const clearFallback = (): void => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    const sendOffer = async (): Promise<void> => {
      const pc = pcRef.current;
      if (!pc || makingOfferRef.current || pc.signalingState !== 'stable') return;
      try {
        makingOfferRef.current = true;
        const offer = await pc.createOffer();
        if (disposed || pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socket.emit(C2S.WEBRTC_OFFER, { description: pc.localDescription });
      } catch (err) {
        console.error('[webrtc] offer failed:', err);
      } finally {
        makingOfferRef.current = false;
      }
    };

    const negotiate = async (): Promise<void> => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!isCallerRef.current && !pc.remoteDescription && fallbackTimerRef.current === null) {
        // Examinee: wait for the examiner's initial offer. The timer is the
        // liveness escape hatch when the caller never sends one (no media).
        fallbackTimerRef.current = window.setTimeout(() => {
          fallbackTimerRef.current = null;
          void sendOffer();
        }, OFFER_FALLBACK_MS);
        return;
      }
      await sendOffer();
    };

    const flushIce = async (): Promise<void> => {
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) return;
      for (const candidate of pendingIceRef.current.splice(0)) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          if (!ignoreOfferRef.current) console.warn('[webrtc] addIceCandidate failed:', err);
        }
      }
    };

    const handleOffer = async (description: RTCSessionDescriptionInit): Promise<void> => {
      if (!pcRef.current) {
        earlySignalsRef.current.push({ kind: 'offer', description });
        return;
      }
      const pc = pcRef.current;
      try {
        const collision = makingOfferRef.current || pc.signalingState !== 'stable';
        ignoreOfferRef.current = !isCallerRef.current && collision;
        if (ignoreOfferRef.current) return; // impolite peer: ignore the late remote offer
        // Polite peer: setRemoteDescription implicitly rolls back our local offer.
        await pc.setRemoteDescription(description);
        clearFallback();
        await flushIce();
        const answer = await pc.createAnswer();
        if (disposed) return;
        await pc.setLocalDescription(answer);
        socket.emit(C2S.WEBRTC_ANSWER, { description: pc.localDescription });
      } catch (err) {
        console.error('[webrtc] handle offer failed:', err);
      }
    };

    const handleAnswer = async (description: RTCSessionDescriptionInit): Promise<void> => {
      if (!pcRef.current) {
        earlySignalsRef.current.push({ kind: 'answer', description });
        return;
      }
      const pc = pcRef.current;
      try {
        await pc.setRemoteDescription(description);
        clearFallback();
        await flushIce();
      } catch (err) {
        console.error('[webrtc] handle answer failed:', err);
      }
    };

    const handleIce = async (candidate: RTCIceCandidateInit | null): Promise<void> => {
      if (!pcRef.current) {
        earlySignalsRef.current.push({ kind: 'ice', candidate });
        return;
      }
      const pc = pcRef.current;
      if (!pc.remoteDescription) {
        pendingIceRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!ignoreOfferRef.current) console.warn('[webrtc] remote ICE failed:', err);
      }
    };

    const onOffer = (p: WebRTCDescriptionPayload): void => {
      if (p?.description) void handleOffer(p.description);
    };
    const onAnswer = (p: WebRTCDescriptionPayload): void => {
      if (p?.description) void handleAnswer(p.description);
    };
    const onIce = (p: WebRTCIcePayload): void => {
      void handleIce(p?.candidate ?? null);
    };

    socket.on(S2C.WEBRTC_OFFER, onOffer);
    socket.on(S2C.WEBRTC_ANSWER, onAnswer);
    socket.on(S2C.WEBRTC_ICE, onIce);

    void (async () => {
      const config = await getIceConfig();
      if (disposed) return;

      const pc = new RTCPeerConnection(config);
      pcRef.current = pc;
      makingOfferRef.current = false;
      ignoreOfferRef.current = false;
      pendingIceRef.current = [];
      remoteMediaRef.current = null;
      restartsRef.current = 0;
      setConnectionState(pc.connectionState);
      setPcEpoch((n) => n + 1);

      pc.onconnectionstatechange = () => {
        if (disposed) return;
        setConnectionState(pc.connectionState);
        if (pc.connectionState === 'connected') restartsRef.current = 0;
        if (pc.connectionState === 'failed' && restartsRef.current < MAX_ICE_RESTARTS) {
          restartsRef.current += 1;
          try {
            pc.restartIce();
          } catch {
            /* already closed */
          }
        }
      };

      pc.ontrack = (e) => {
        if (disposed) return;
        const stream = e.streams[0];
        if (stream) {
          remoteMediaRef.current = stream;
          setRemoteStream(stream);
        } else {
          if (!remoteMediaRef.current) remoteMediaRef.current = new MediaStream();
          remoteMediaRef.current.addTrack(e.track);
          setRemoteStream(remoteMediaRef.current);
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        socket.emit(C2S.WEBRTC_ICE, { candidate });
      };

      pc.onnegotiationneeded = () => {
        void negotiate();
      };

      // Signals that raced ahead of the connection setup.
      for (const buffered of earlySignalsRef.current.splice(0)) {
        if (buffered.kind === 'offer') void handleOffer(buffered.description);
        else if (buffered.kind === 'answer') void handleAnswer(buffered.description);
        else void handleIce(buffered.candidate);
      }
    })();

    return () => {
      disposed = true;
      clearFallback();
      socket.off(S2C.WEBRTC_OFFER, onOffer);
      socket.off(S2C.WEBRTC_ANSWER, onAnswer);
      socket.off(S2C.WEBRTC_ICE, onIce);
      const pc = pcRef.current;
      pcRef.current = null;
      if (pc) pc.close();
      remoteMediaRef.current = null;
      pendingIceRef.current = [];
      earlySignalsRef.current = [];
      setRemoteStream(null);
      setConnectionState('idle');
    };
  }, [active, socket, buildId]);

  // Attach local tracks (added or replaced) — fires negotiationneeded.
  useEffect(() => {
    if (!active) return;
    const pc = pcRef.current;
    if (!pc || !localStream) return;
    for (const track of localStream.getTracks()) {
      const already = pc.getSenders().some((s) => s.track === track);
      if (!already) pc.addTrack(track, localStream);
    }
  }, [active, localStream, pcEpoch]);

  const retry = useCallback(() => {
    setBuildId((n) => n + 1);
  }, []);

  return { remoteStream, connectionState, retry };
}
