import type { ReactNode } from 'react';
import { useMatch } from '../state/MatchContext';
import { CueCardView } from './CueCardView';
import { Scratchpad } from './Scratchpad';

/** Examinee side: status text per part, cue card during Part 2, local notes. */
export function ExamineePanel() {
  const { state } = useMatch();
  const session = state.session;
  if (!session) return null;

  const scoredThisRound = session.scores.some((s) => s.roundNumber === session.roundNumber);

  let body: ReactNode = null;

  if (scoredThisRound) {
    body = (
      <div className="status-block">
        <p className="success-text">✅ Your examiner submitted the score for this round.</p>
        <p className="muted">
          {session.roundNumber === 1 ? 'Swapping roles for round 2…' : 'Finishing the match…'}
        </p>
      </div>
    );
  } else if (session.part === 0) {
    body = (
      <div className="status-block">
        <p>Waiting for the examiner to start Part 1…</p>
        <p className="muted">Get comfortable — the interview starts any moment.</p>
      </div>
    );
  } else if (session.part === 1) {
    body = (
      <div className="status-block">
        <span className="part-chip">Part 1 · Interview</span>
        <p>
          The examiner asks short questions about familiar topics. Give natural answers —
          a sentence or two each is fine.
        </p>
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 2 && session.stage === 'ended') {
    body = (
      <div className="status-block">
        <span className="part-chip">Part 2 · Long turn</span>
        <div className="notice">⏱ Time&apos;s up — the cue card is now hidden.</div>
        <p className="muted">
          Keep talking on the same topic until the examiner moves on.
        </p>
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 2 && session.card && (session.stage === 'prep' || session.stage === 'talk')) {
    body = (
      <div className="status-block">
        <CueCardView
          card={session.card}
          timer={session.timer}
          stage={session.stage}
        />
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  } else if (session.part === 3) {
    body = (
      <div className="status-block">
        <span className="part-chip">Part 3 · Discussion</span>
        <p>
          The examiner asks wider, more abstract questions on the topic. Give fuller
          answers with reasons and examples.
        </p>
        <p className="muted">When you&apos;re done, the examiner will submit your band.</p>
        <Scratchpad matchId={session.matchId} />
      </div>
    );
  }

  return <div className="examinee-panel">{body}</div>;
}
