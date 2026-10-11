import { useServerTimer } from '../hooks/useServerTimer';
import type { TimerStartPayload } from '../lib/events';

interface Props {
  remainingSec: number;
  totalSec: number;
  /** 'prep' or 'talk' — decides the idle wording. */
  label: 'prep' | 'talk';
}

/**
 * Horizontal countdown for phones. The ring is a good desktop object but it
 * costs ~112px of a pinned band; a strip says the same thing in ~40px and
 * leaves the room the card and the notes need. Urgency is carried by a word as
 * well as the colour, so it survives greyscale and colour blindness — the
 * design's "never colour alone" rule.
 */
export function CountdownStrip({ remainingSec, totalSec, label }: Props) {
  const fraction = totalSec > 0 ? Math.min(1, Math.max(0, remainingSec / totalSec)) : 0;
  const mins = Math.floor(remainingSec / 60);
  const secs = Math.floor(remainingSec % 60);
  const secondsLeft = Math.max(0, Math.ceil(remainingSec));

  const urgent = remainingSec <= 5;
  const warning = !urgent && remainingSec <= 15;
  const tone = urgent ? 'urgent' : warning ? 'warning' : '';

  const phrase = urgent
    ? `${secondsLeft}s left — wrap up`
    : warning
      ? `${secondsLeft}s left`
      : label === 'prep'
        ? 'Preparation time'
        : 'Speaking time';

  return (
    <div className={`countdown-strip ${tone}`} role="timer" aria-live="off">
      <div className="countdown-strip-head">
        <span className="countdown-strip-phrase">{phrase}</span>
        <span className="countdown-strip-time">
          {mins}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div className="countdown-strip-track" aria-hidden="true">
        <div className="countdown-strip-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Part 2 talk countdown for the pinned phone column: the seconds want to sit
 * directly under the face being watched, not in the panel below it. Owns its
 * own timer subscription so MatchPage can render it without extra state.
 */
export function TalkCountdown({ timer }: { timer: TimerStartPayload }) {
  const cd = useServerTimer(timer);
  return (
    <CountdownStrip remainingSec={cd.remainingSec} totalSec={timer.durationSec} label="talk" />
  );
}
