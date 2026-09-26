import { useState } from 'react';

/**
 * Local-only notes for the examinee. Stored in sessionStorage on this device
 * and never emitted over the socket (plan verification step 4).
 */
export function Scratchpad({ matchId }: { matchId: string }) {
  const key = `ielts.notes.${matchId}`;
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  });

  const save = (value: string) => {
    setText(value);
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // storage full / private mode — notes stay in memory for this tab
    }
  };

  return (
    <div className="scratchpad">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Notes</strong>
        <span className="muted small">Stays on this device — never sent to your partner.</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => save(e.target.value)}
        rows={5}
        placeholder="Keywords & phrases… (or use pen & paper)"
        spellCheck={false}
      />
    </div>
  );
}
