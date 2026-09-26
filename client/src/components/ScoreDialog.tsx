import { useState } from 'react';
import { examError } from '../lib/examErrors';
import { useMatch } from '../state/MatchContext';

const BANDS = Array.from({ length: 19 }, (_, i) => i / 2); // 0 → 9 step 0.5

/** Examiner's out-of-9 (half-band) score entry for the current round. */
export function ScoreDialog() {
  const { submitScore } = useMatch();
  const [band, setBand] = useState('7.0');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await submitScore(Number(band));
    } catch (e) {
      setErr(examError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="score-dialog">
      <h3>Score the test</h3>
      <p className="muted small">
        IELTS-style overall band from 0 to 9 (half-bands allowed). Consider fluency,
        vocabulary, grammar and pronunciation.
      </p>
      <div className="row">
        <label className="row" style={{ gap: '0.5rem' }}>
          <span className="muted">Band</span>
          <select value={band} onChange={(e) => setBand(e.target.value)} disabled={busy}>
            {BANDS.map((b) => (
              <option key={b} value={b}>
                {b.toFixed(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : 'Submit score'}
        </button>
      </div>
      {err && <p className="error-text">{err}</p>}
    </div>
  );
}
