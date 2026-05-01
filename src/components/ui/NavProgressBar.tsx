import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import './NavProgressBar.css';

// ─── Suspense signal context ─────────────────────────────────────────────────
// PageLoader (Suspense fallback) signals "loading" while a lazy chunk is loading.
// NavProgressBar holds at 80% until the suspending content resolves.

interface SuspendingCtx {
  isSuspending: boolean;
  setSuspending: (v: boolean) => void;
}

const SuspendingContext = createContext<SuspendingCtx>({
  isSuspending: false,
  setSuspending: () => {},
});

export function NavProgressProvider({ children }: { children: ReactNode }) {
  const [isSuspending, setSuspending] = useState(false);
  return (
    <SuspendingContext.Provider value={{ isSuspending, setSuspending }}>
      {children}
    </SuspendingContext.Provider>
  );
}

/** Call this inside the Suspense fallback component to signal loading. */
export function useSignalSuspending() {
  const { setSuspending } = useContext(SuspendingContext);
  useEffect(() => {
    setSuspending(true);
    return () => setSuspending(false);
  }, [setSuspending]);
}

// ─── Progress bar ────────────────────────────────────────────────────────────

type Phase = 'idle' | 'starting' | 'loading' | 'finishing';

export default function NavProgressBar() {
  const location = useLocation();
  const { isSuspending } = useContext(SuspendingContext);
  const [phase, setPhase] = useState<Phase>('idle');
  const [width, setWidth] = useState(0);
  const firstRenderRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Trigger on every pathname change
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    // Clear any in-flight timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    setPhase('starting');
    setWidth(0);

    // Move to 80% quickly to feel responsive
    const t1 = setTimeout(() => {
      setPhase('loading');
      setWidth(80);
    }, 30);
    timersRef.current.push(t1);
  }, [location.pathname]);

  // When the new route's content has rendered (Suspense resolved or never suspended),
  // jump to 100% and fade out.
  useEffect(() => {
    if (phase !== 'loading' && phase !== 'starting') return;
    if (isSuspending) return; // hold while lazy chunk loads

    // Give the new page a beat to commit before completing
    const t1 = setTimeout(() => {
      setPhase('finishing');
      setWidth(100);
      const t2 = setTimeout(() => {
        setPhase('idle');
        setWidth(0);
      }, 220);
      timersRef.current.push(t2);
    }, 80);
    timersRef.current.push(t1);

    return () => {
      // Don't clear on unmount of effect run — let the chained timers complete
    };
  }, [phase, isSuspending]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => { timersRef.current.forEach(clearTimeout); };
  }, []);

  if (phase === 'idle') return null;

  return (
    <div
      className={`nav-progress ${phase === 'finishing' ? 'nav-progress--finishing' : ''}`}
      style={{ width: `${width}%` }}
      aria-hidden="true"
    />
  );
}
