import { useEffect, useReducer } from 'react';
import { serverNow } from '../lib/clock';
import type { TimerStartPayload } from '../lib/events';

export interface Countdown {
  /** Seconds left, floored at 0. 0 when there is no active timer. */
  remainingSec: number;
  /** 0 → 1 progress over the timer's duration. */
  progress: number;
  active: boolean;
}

/**
 * Renders a server-driven timer (timer:start payload) on the local frame
 * clock. The server is authoritative — timer:end / part:changed decide state;
 * this only animates until then.
 */
export function useServerTimer(timer: TimerStartPayload | null): Countdown {
  const [, tick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!timer) return;
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
  }, [timer]);

  if (!timer) return { remainingSec: 0, progress: 0, active: false };

  const remainingMs = timer.endsAt - serverNow();
  const remainingSec = Math.max(0, remainingMs / 1000);
  const progress =
    timer.durationSec > 0
      ? Math.min(1, Math.max(0, 1 - remainingSec / timer.durationSec))
      : 0;
  return { remainingSec, progress, active: remainingMs > 0 };
}
