import { useEffect } from 'react';
import { DisconnectedBanner } from '../components/DisconnectedBanner';
import { CueCardView } from '../components/CueCardView';
import { ExaminerPanel } from '../components/ExaminerPanel';
import { ExamineePanel } from '../components/ExamineePanel';
import { ReadyGate } from '../components/ReadyGate';
import { ResultsView } from '../components/ResultsView';
import { VideoStage } from '../components/VideoStage';
import { useKeyboardOpen } from '../hooks/useKeyboardOpen';
import { useMedia } from '../hooks/useMedia';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { useWakeLock } from '../hooks/useWakeLock';
import { useWebRTC } from '../hooks/useWebRTC';
import { C2S } from '../lib/events';
import { useMatch } from '../state/MatchContext';

export function MatchPage() {
  const { state, leaveMatch, socket } = useMatch();
  const session = state.session;
  const phoneLayout = usePhoneLayout();
  const keyboardOpen = useKeyboardOpen();

  const media = useMedia();
  const down = Boolean(session && (session.peerDisconnected || session.peerLeft));
  const live = Boolean(session) && !session!.completed && !down;

  const { remoteStream, connectionState, retry } = useWebRTC({
    active: live,
    isCaller: session?.caller ?? false,
    localStream: media.stream,
    socket,
  });

  useWakeLock(live);

  // Auto-open the camera/mic the moment a match is found: the browser's
  // permission prompt appears on its own (no extra tap needed) and ReadyGate
  // then confirms readiness automatically. Denial falls back to the
  // ReadyGate buttons / the mid-match "Enable camera & mic" control.
  const matchId = session?.matchId;
  const { start: startMedia } = media;
  useEffect(() => {
    if (!matchId) return;
    void startMedia();
  }, [matchId, startMedia]);

  // Tell the peer about our mic/cam state whenever it changes.
  const { mic, cam } = media;
  useEffect(() => {
    if (!socket || !matchId) return;
    socket.emit(C2S.MEDIA_STATE, { mic, cam });
  }, [socket, matchId, mic, cam]);

  if (!session) {
    return (
      <div className="page">
        <div className="card muted">Looking for your match...</div>
      </div>
    );
  }

  const bothReady = session.youReady && session.peerReady;
  const showStage = live && Boolean(socket);

  // On phones the pinned video is a short face strip whenever the exam panel is
  // the working surface rather than the thing being watched: the examiner reads
  // the question bank throughout, and in Part 2 the examinee needs the cue card
  // or the talk countdown in view. Outside those stages the full stage stays —
  // watching your partner's answer is the point of Parts 1 and 3.
  const stripVideo = session.role === 'examiner' || session.part === 2;

  // During prep the cue card is what the minute is for, so on phones it moves
  // into the pinned column and the copy in the exam panel is dropped — that
  // keeps the card on screen while the notes are typed. Desktop is unchanged.
  const examPrepHidden =
    phoneLayout &&
    session.role === 'examinee' &&
    session.part === 2 &&
    session.stage === 'prep' &&
    Boolean(session.card);

  // Once the keyboard is up the notes field is the working surface: the video
  // leaves entirely (a pinned band plus a cue card plus a keyboard leaves no
  // room to type in) and the card shrinks to a summary that scrolls inline.
  const showCueStrip = examPrepHidden && !keyboardOpen;

  const layoutClass = [
    'match-layout',
    showStage ? '' : 'no-video',
    showStage && stripVideo ? 'strip-video' : '',
    showStage && examPrepHidden ? 'sticky-cue' : '',
    keyboardOpen && examPrepHidden ? 'keyboard-up' : '',
  ]
    .filter(Boolean)
    .join(' ');

  let body;
  if (session.completed) {
    body = <ResultsView />;
  } else if (down) {
    body = <DisconnectedBanner />;
  } else if (!session.set) {
    body = <div className="card muted">Loading the question set...</div>;
  } else if (!bothReady) {
    body = <ReadyGate media={media} />;
  } else if (session.role === 'examiner') {
    body = <ExaminerPanel />;
  } else {
    body = <ExamineePanel />;
  }

  return (
    <div className="page match-page">
      <div className="card match-header">
        <div className="row">
          <div className="match-meta">
            <span className={`role-tag ${session.role}`}>{session.role}</span>
            <span className="muted match-round">
              Round {session.roundNumber} of 2 · with{' '}
              <strong className="peer-name">{session.peer.nickname}</strong>
              {session.code && (
                <>
                  {' '}
                  · code <code>{session.code}</code>
                </>
              )}
            </span>
          </div>
          <button type="button" className="danger" onClick={leaveMatch}>
            Leave
          </button>
        </div>
      </div>
      <div className={layoutClass}>
        {showStage && (
          <div className="video-col">
            <VideoStage
              peerStream={remoteStream}
              selfStream={media.stream}
              peerName={session.peer.nickname}
              peerMic={session.peerMic}
              peerCam={session.peerCam}
              selfMic={media.mic}
              selfCam={media.cam}
              hasMedia={Boolean(media.stream)}
              onToggleMic={media.toggleMic}
              onToggleCam={media.toggleCam}
              onEnable={() => void media.start()}
              enabling={media.starting}
              connectionState={connectionState}
              onRetry={retry}
              mediaError={media.error}
            />
            {showCueStrip && <CueCardView card={session.card!} timer={session.timer} stage="prep" />}
          </div>
        )}
        <div className="exam-col">{body}</div>
      </div>
    </div>
  );
}
