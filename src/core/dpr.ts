/**
 * Calls `onChange` whenever devicePixelRatio changes
 * (browser zoom, moving the window between displays). Returns an unsubscribe fn.
 */
export function watchPixelRatio(onChange: (dpr: number) => void): () => void {
  let mq: MediaQueryList | null = null;

  const handler = () => {
    onChange(window.devicePixelRatio);
    bind(); // the query string depends on the current ratio, so re-arm it
  };

  const bind = () => {
    mq?.removeEventListener('change', handler);
    mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', handler);
  };

  bind();
  return () => mq?.removeEventListener('change', handler);
}
