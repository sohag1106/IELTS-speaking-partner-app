import type { ReactNode } from 'react';
import { usePhoneLayout } from '../hooks/usePhoneLayout';
import { useServerTimer } from '../hooks/useServerTimer';
import { useMatch } from '../state/MatchContext';
import { CueCardView } from './CueCardView';
import { CountdownRing } from './CountdownRing';
import { Scratchpad } from './Scratchpad';

/** Examinee side: status text per part, cue card during Part 2, local notes. */
export function ExamineePanel() {
  const { state } = useMatch();
  const session = state.session;
  const cd = useServerTimer(session?.timer ?? null);
  const phoneLayout = usePhoneLayout();
  if (!session) return null;

  const scoredThisRound = session.scores.some((s) => s.roundNumber === session.roundNumber);

  let body: ReactNode = null;

  if (scoredThisRound) {
    body = (
      <div className="status-block">
        <p className="success-text">Your examiner submitted the score for this round.</p>
        <p className="muted">
          {session.roundNumber === 1 ? 'Swapping roles for round 2...' : 'Finishing the match...'}
        </p>
      </div>
    );
  } else if (session.part === 0) {
    body = (
      <div className="status-block">
        <p>Waiting for the examiner to start Part 1...</p>
        <p className="muted">Get comfortable — the interview starts any moment.</p>
      </div>
    );
  } else if (session.part === 1) {
    body = (
      <div className="status-block">
        <span className="part-chip">Part 1 · Interview</span>
        <p>
          The examiner asks short questions about familiar topics. Give natural answers — a
          sentence or two each is fine.
        </p>
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 2 && session.stage === 'prep' && session.card) {
    // Preparation: the card is visible so you can read it and take notes. On a
    // phone the card itself lives in the pinned column (MatchPage), so this
    // branch drops it and leaves the notes — the card is already on screen, and
    // it carries the countdown in both layouts, so there is no second copy here.
    body = (
      <div className="status-block">
        {!phoneLayout && (
          <CueCardView card={session.card} timer={session.timer} stage="prep" />
        )}
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 2 && session.stage === 'talk') {
    // Preparation is over: the card is hidden and the 2-minute talk countdown
    // runs. On a phone the countdown is pinned under the examiner's face
    // (MatchPage), so this branch leaves a word instead of a second timer.
    body = (
      <div className="status-block">
        <span className="part-chip">Part 2 · Long turn</span>
        <p className="muted">
          Preparation time is over — the cue card is now hidden. Keep speaking on the same
          topic until the timer runs out, using your notes below.
        </p>
        {!phoneLayout && session.timer && (
          <div className="talk-countdown">
            <CountdownRing
              remainingSec={cd.remainingSec}
              totalSec={session.timer.durationSec}
              label="talk"
            />
          </div>
        )}
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 2 && session.stage === 'ended') {
    body = (
      <div className="status-block">
        <span className="part-chip">Part 2 · Long turn</span>
        <div className="notice">Time&apos;s up — Part 2 is finished.</div>
        <p className="muted">The examiner will continue shortly.</p>
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 3) {
    body = (
      <div className="status-block">
        <span className="part-chip">Part 3 · Discussion</span>
        <p>
          The examiner asks wider, more abstract questions on the topic. Give fuller answers
          with reasons and examples.
        </p>
        <p className="muted">When you&apos;re done, the examiner will submit your band.</p>
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  }

  return (
    <div className="examinee-panel">
      {session.followup && (
        <div className="followup-q">
          <span className="muted small">Examiner asks:</span>
          <p>{session.followup}</p>
        </div>
      )}
      {body}
    </div>
  );
}