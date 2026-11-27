import { useEffect, useState } from 'react';

export type Dock = 'left' | 'right' | 'bottom';

const NARROW_QUERY = '(max-width: 640px)';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage unavailable (private mode, blocked)
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the choice just is not remembered
  }
}

/**
 * Dock position and open/collapsed state of the control panel, remembered per
 * demo through `storageKey`. On narrow screens the panel always docks at the bottom.
 */
export function useDockLayout(storageKey: string, defaults: { dock?: Dock; open?: boolean } = {}) {
  const [dock, setDockState] = useState<Dock>(() => {
    const saved = read(`${storageKey}:dock`);
    return saved === 'left' || saved === 'right' || saved === 'bottom' ? saved : (defaults.dock ?? 'bottom');
  });
  const [open, setOpenState] = useState<boolean>(() => {
    const saved = read(`${storageKey}:open`);
    return saved === null ? (defaults.open ?? true) : saved === 'true';
  });
  const [narrow, setNarrow] = useState<boolean>(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setDock = (next: Dock) => {
    setDockState(next);
    write(`${storageKey}:dock`, next);
  };
  const setOpen = (next: boolean) => {
    setOpenState(next);
    write(`${storageKey}:open`, String(next));
  };

  const effectiveDock: Dock = narrow ? 'bottom' : dock;
  return { dock, effectiveDock, open, narrow, setDock, setOpen };
}
