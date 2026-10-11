import { useEffect, useState } from 'react';

/** Matches the phone breakpoint the sticky video column uses in global.css. */
const QUERY = '(max-width: 899px)';

/**
 * True while the viewport is phone-sized. Used to move a panel element into the
 * pinned video column, which only happens in the stacked (non-desktop) layout.
 */
export function usePhoneLayout(): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return matches;
}
