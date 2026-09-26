import { useEffect } from 'react';

/**
 * Keeps the screen awake while a match is live (mobile browsers dim otherwise).
 * Silently no-ops where the Screen Wake Lock API is unavailable.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> };
    };
    if (!nav.wakeLock) return;

    let sentinel: { release(): Promise<void> } | null = null;
    let disposed = false;

    const acquire = async (): Promise<void> => {
      if (disposed || sentinel) return;
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        // Permission denied or page hidden — retry happens on visibilitychange.
      }
    };

    void acquire();

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
