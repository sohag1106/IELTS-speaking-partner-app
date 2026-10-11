import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { examError } from '../lib/examErrors';
import { useMatch } from '../state/MatchContext';
import { CueCardView } from './CueCardView';
import { ScoreDialog } from './ScoreDialog';

/**
 * The 4-up progress bar. Questions are ticked locally — the server has no
 * concept of "asked", and inventing one would put exam state behind a
 * UI convenience. Reset per part.
 */
function PartBar({
  part,
  maxPart,
  scored,
  total,
  ticked,
  onToggle,
}: {
  part: number;
  maxPart: number;
  scored: boolean;
  total: number;
  ticked: Set<number>;
  onToggle: (i: number) => void;
}) {
  const steps = [1, 2, 3] as const;
  return (
    <div className="part-bar-wrap">
      <div className="stepper" aria-label="exam progress">
        {steps.map((p) => (
          <span
            key={p}
            className={`step ${maxPart > p ? 'done' : ''} ${part === p && !scored ? 'current' : ''}`}
          >
            Part {p}
          </span>
        ))}
        <span className={`step ${scored ? 'done current' : ''}`}>Score</span>
      </div>

      {total > 0 && part >= 1 && part <= 3 && (
        <div className="ask-tracker">
          <span className="ask-tracker-label">
            {ticked.size} of {total} asked
          </span>
          <div className="ask-ticks">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`ask-tick${ticked.has(i) ? ' on' : ''}`}
                onClick={() => onToggle(i)}
                aria-pressed={ticked.has(i)}
                aria-label={`Mark question ${i + 1} as asked`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Examiner side: progress controls, active cue card, and the question bank. */
export function ExaminerPanel() {
  const { state, startPart, hideNow, askFollowup } = useMatch();
  const session = state.session;
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [followup, setFollowup] = useState('');
  const [ticked, setTicked] = useState<Set<number>>(() => new Set());

  const part = session?.part ?? 0;
  const stage = session?.stage ?? null;

  // Reset the card picker and the local ticks whenever the part advances.
  useEffect(() => {
    setPicking(false);
    setTicked(new Set());
  }, [part]);

  const questions = useMemo(() => {
    if (!session?.set) return [];
    if (part === 1) return session.set.part1.map((q) => q.prompt);
    if (part === 3) return session.set.part3.map((q) => q.prompt);
    return [];
  }, [session?.set, part]);

  if (!session || !session.set) return null;

  const scoredThisRound = session.scores.some((s) => s.roundNumber === session.roundNumber);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(examError(e));
    } finally {
      setBusy(false);
    }
  };

  const onFollowupSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = followup.trim();
    if (text.length < 2) return;
    run(async () => {
      await askFollowup(text);
      setFollowup('');
    });
  };

  const toggleTick = (i: number) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="examiner-grid">
      <div className="card examiner-controls">
        <PartBar
          part={part}
          maxPart={session.maxPart}
          scored={scoredThisRound}
          total={questions.length}
          ticked={ticked}
          onToggle={toggleTick}
        />

        {part === 0 && (
          <div className="control-block">
            <p className="muted">Both players are ready. Begin the interview.</p>
            <button type="button" disabled={busy} onClick={() => run(() => startPart(1))}>
              Start Part 1
            </button>
          </div>
        )}

        {part === 1 && (
          <div className="control-block">
            <p className="muted">Ask 2–3 questions from the Part 1 list, then move on.</p>
            {!picking ? (
              <button type="button" disabled={busy} onClick={() => setPicking(true)}>
                Part 2 — choose a cue card
              </button>
            ) : (
              <div className="card-chooser">
                <p className="muted small">Pick one card — the examinee sees it for 1 minute.</p>
                {session.set.part2.map((c, i) => (
                  <div key={c.ordinal} className={`card-option${i === 0 ? ' lead' : ''}`}>
                    <span className="muted small">Card {c.ordinal}</span>
                    <p className="card-option-prompt">{c.prompt}</p>
                    {/* One line: three cards have to fit a phone scroll, not
                        three screens. Full bullets stay in the question bank. */}
                    <p className="card-option-summary">{c.bullets.join(' · ')}</p>
                    <button
                      type="button"
                      className={i === 0 ? undefined : 'secondary'}
                      disabled={busy}
                      onClick={() => run(() => startPart(2, c.ordinal))}
                    >
                      Start this card
                    </button>
                  </div>
                ))}
                <button type="button" className="secondary" onClick={() => setPicking(false)}>
                  Back
                </button>
              </div>
            )}
          </div>
        )}

        {part === 2 && (stage === 'prep' || stage === 'talk') && session.card && (
          <div className="control-block">
            <CueCardView card={session.card} timer={session.timer} stage={stage} />
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={() => run(() => hideNow())}
            >
              Hide card now
            </button>
          </div>
        )}

        {part === 2 && stage === 'ended' && (
          <div className="control-block">
            <p className="muted">Part 2 finished. Move to the discussion questions.</p>
            <button type="button" disabled={busy} onClick={() => run(() => startPart(3))}>
              Start Part 3
            </button>
          </div>
        )}

        {part === 3 && !scoredThisRound && (
          <div className="control-block">
            <p className="muted">Ask discussion questions, then score the test.</p>
            <ScoreDialog />
          </div>
        )}

        {scoredThisRound && (
          <div className="control-block">
            <p className="success-text">
              ✅ Band submitted — {session.roundNumber === 1 ? 'swapping roles…' : 'finishing up…'}
            </p>
          </div>
        )}

        {part >= 1 && !scoredThisRound && (
          <form className="followup-form" onSubmit={onFollowupSubmit}>
            <label className="muted small" htmlFor="followup-input">
              Ask an extra relevant question — it pops up on the examinee&apos;s screen.
            </label>
            <div className="row">
              <input
                id="followup-input"
                value={followup}
                onChange={(e) => setFollowup(e.target.value)}
                placeholder="e.g. Do you still keep in touch with them?"
                maxLength={200}
              />
              <button type="submit" disabled={busy || followup.trim().length < 2}>
                Ask
              </button>
            </div>
          </form>
        )}

        {/* Echo it back: today the examiner can't see what they sent. */}
        {session.followup && (
          <div className="followup-q sent">
            <span className="muted small">You asked:</span>
            <p>{session.followup}</p>
          </div>
        )}

        {err && <p className="error-text">{err}</p>}
      </div>

      <div className="card question-bank">
        <h3>Question bank</h3>
        <p className="muted small">
          Topic set: <strong>{session.set.title}</strong> — ask these in order.
        </p>

        <section className={part === 1 ? 'q-section active' : 'q-section'}>
          <h4>Part 1 · Interview</h4>
          <ol>
            {session.set.part1.map((q, i) => (
              <li key={i} className={part === 1 && ticked.has(i) ? 'asked' : undefined}>
                {q.prompt}
              </li>
            ))}
          </ol>
        </section>

        <section className={part === 2 ? 'q-section active' : 'q-section'}>
          <h4>Part 2 · Long turn (cue cards)</h4>
          {session.set.part2.map((c) => (
            <div key={c.ordinal} className="q-card">
              <strong>
                Card {c.ordinal}: {c.prompt}
              </strong>
              <ul>
                {c.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className={part === 3 ? 'q-section active' : 'q-section'}>
          <h4>Part 3 · Discussion</h4>
          <ol>
            {session.set.part3.map((q, i) => (
              <li key={i} className={part === 3 && ticked.has(i) ? 'asked' : undefined}>
                {q.prompt}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
