import { useEffect, useState } from 'react';

/**
 * True while the soft keyboard is open. `visualViewport` shrinks when the
 * keyboard appears, so a large gap between it and the layout viewport means the
 * keyboard is up. Used to give the notes field the screen while typing.
 */
const GAP_PX = 120;

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let wasOpen = false;

    const measure = () => {
      const gap = window.innerHeight - vv.height;
      const isOpen = gap > GAP_PX || vv.height / window.innerHeight < 0.75;
      setOpen(isOpen);

      // The layout reflows as the keyboard appears (the video column leaves),
      // which can strand the field being typed in underneath it. Bring it back
      // once the reflow has settled.
      if (isOpen && !wasOpen) {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) {
          window.setTimeout(() => focused.scrollIntoView({ block: 'center' }), 250);
        }
      }
      wasOpen = isOpen;
    };

    measure();
    vv.addEventListener('resize', measure);
    return () => vv.removeEventListener('resize', measure);
  }, []);

  return open;
}
