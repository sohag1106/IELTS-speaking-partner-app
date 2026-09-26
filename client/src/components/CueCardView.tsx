import { useServerTimer } from '../hooks/useServerTimer';
import type { TimerStartPayload } from '../lib/events';
import { CountdownRing } from './CountdownRing';

export interface CueCard {
  prompt: string;
  leadIn: string;
  bullets: string[];
}

interface Props {
  card: CueCard;
  timer: TimerStartPayload | null;
  stage: 'prep' | 'talk';
}

/** The examinee's Part 2 cue card, with the server-driven countdown. */
export function CueCardView({ card, timer, stage }: Props) {
  const cd = useServerTimer(timer);

  return (
    <div className="cue-card">
      <div className="cue-card-head">
        <span className={`cue-badge ${stage}`}>
          {stage === 'prep' ? 'Preparation time' : 'Speak now'}
        </span>
        {timer && (
          <CountdownRing
            remainingSec={cd.remainingSec}
            totalSec={timer.durationSec}
            label={stage === 'prep' ? 'prep' : 'talk'}
          />
        )}
      </div>
      <h2 className="cue-prompt">{card.prompt}</h2>
      {card.leadIn && <p className="cue-lead">{card.leadIn}</p>}
      <ul className="cue-bullets">
        {card.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      {stage === 'prep' && (
        <p className="muted small">
          Jot down ideas below — the card disappears when preparation time ends.
        </p>
      )}
      {stage === 'talk' && (
        <p className="muted small">Keep going until the timer runs out or the examiner stops you.</p>
      )}
    </div>
  );
}
