import { useState, useEffect } from 'react';
import { getFanGraphsStatus } from '../data/api/fangraphs';

/**
 * Polls the FanGraphs module-level availability flag that gets set as a
 * side-effect of any fetch attempt.  Returns 'unknown' until a request
 * completes, then either 'ok' or 'blocked'.
 *
 * Components can use this to show a subtle fallback notice rather than
 * silently rendering empty tables when CORS blocks FanGraphs in production.
 */
export function useFanGraphsStatus(): 'unknown' | 'ok' | 'blocked' {
  const [status, setStatus] = useState<'unknown' | 'ok' | 'blocked'>(
    getFanGraphsStatus()
  );

  useEffect(() => {
    // The status is set as a side-effect of the first FanGraphs fetch attempt.
    // Poll until it resolves (max ~10 s) — the interval is intentionally short
    // so the banner appears quickly once we know the outcome.
    if (getFanGraphsStatus() !== 'unknown') return;

    let attempts = 0;
    const id = setInterval(() => {
      const s = getFanGraphsStatus();
      if (s !== 'unknown') {
        setStatus(s);
        clearInterval(id);
        return;
      }
      if (++attempts > 20) clearInterval(id); // give up after ~10 s
    }, 500);

    return () => clearInterval(id);
  }, []);

  return status;
}
