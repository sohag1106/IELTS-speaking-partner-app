import { useState } from 'react';
import { examError } from '../lib/examErrors';
import { useMatch } from '../state/MatchContext';

const BANDS = Array.from({ length: 19 }, (_, i) => i / 2); // 0 → 9 step 0.5
const CRITERIA = ['Fluency & coherence', 'Lexical resource', 'Grammar range', 'Pronunciation'];

/**
 * Examiner's out-of-9 (half-band) score entry for the current round. Nineteen
 * individual numbers is a scroll on a phone and a native <select> puts the
 * band behind a wheel the examiner cannot see while they decide, so the whole
 * scale is laid out as chips with the chosen number shown large above it.
 */
export function ScoreDialog() {
  const { submitScore, state } = useMatch();
  const peer = state.session?.peer.nickname;
  const [band, setBand] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await submitScore(band);
    } catch (e) {
      setErr(examError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="score-dialog">
      <h3>Score the test</h3>
      <p className="muted small">Overall band, 0 to 9 — half bands allowed.</p>

      <ul className="criteria-list">
        {CRITERIA.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <div className="band-readout">
        <span className="band-readout-value">{band.toFixed(1)}</span>
        <span className="band-readout-label">out of 9</span>
      </div>

      <div className="band-grid" role="group" aria-label="Overall band">
        {BANDS.map((b) => (
          <button
            key={b}
            type="button"
            className={`band-chip${band === b ? ' on' : ''}${Number.isInteger(b) ? ' whole' : ''}`}
            aria-pressed={band === b}
            disabled={busy}
            onClick={() => setBand(b)}
          >
            {b.toFixed(1)}
          </button>
        ))}
      </div>

      <button type="button" className="cta" onClick={submit} disabled={busy}>
        {busy ? 'Saving…' : `Submit score — ${band.toFixed(1)}${peer ? ` for ${peer}` : ''}`}
      </button>
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}
