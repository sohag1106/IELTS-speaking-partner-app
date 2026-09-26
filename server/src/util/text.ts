/**
 * Strip control characters, zero-width and bidi marks, collapse whitespace
 * and cap length. Used for any free text a peer sends to the other side.
 */
export function sanitizeText(raw: string, max: number): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) continue; // C0 + C1 controls
    if (code === 0x200b || code === 0x200c || code === 0x200d || code === 0x2060) continue; // zero-width
    if (code >= 0x202a && code <= 0x202e) continue; // bidi embedding/override
    if (code >= 0x2066 && code <= 0x2069) continue; // bidi isolates
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim().slice(0, max);
}
