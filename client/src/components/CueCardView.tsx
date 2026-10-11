import { useServerTimer } from '../hooks/useServerTimer';
import type { TimerStartPayload } from '../lib/events';
import { CountdownRing } from './CountdownRing';
import { CountdownStrip } from './CountdownStrip';

export interface CueCard {
  prompt: string;
  leadIn: string;
  bullets: string[];
}

interface Props {
  card: CueCard;
  timer: TimerStartPayload | null;
  stage: 'prep' | 'talk';
  /**
   * Phone layout: swaps the ring for a strip and the ring's inline copy for a
   * one-line legend. The ring is a fine desktop object but in a pinned band it
   * costs the room the card needs.
   */
  compact?: boolean;
}

/** The examinee's Part 2 cue card, with the server-driven countdown. */
export function CueCardView({ card, timer, stage, compact = false }: Props) {
  const cd = useServerTimer(timer);

  return (
    <div className="cue-card">
      {/* Compact carries the countdown itself, so it becomes the head — a badge
          above a strip above the prompt spent 90px of a pinned band saying the
          same thing twice. */}
      {timer && compact ? (
        <CountdownStrip
          remainingSec={cd.remainingSec}
          totalSec={timer.durationSec}
          label={stage === 'prep' ? 'prep' : 'talk'}
        />
      ) : (
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
      )}
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
        <p className="muted small">
          Keep going until the timer runs out or the examiner stops you.
        </p>
      )}
    </div>
  );
}
