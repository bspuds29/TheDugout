import { useState, useEffect, useCallback } from 'react';

/**
 * Persistent state hook backed by localStorage.
 * - SSR-safe (lazy reads on first render in browser)
 * - Multi-tab sync via the `storage` event
 * - Type-safe via generic
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const read = (): T => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  };

  const [value, setValue] = useState<T>(read);

  // Sync changes to localStorage and broadcast via storage event
  const update = useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch { /* quota exceeded — ignore */ }
      return next;
    });
  }, [key]);

  // Listen for changes from other tabs / windows
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try { setValue(JSON.parse(e.newValue) as T); } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, update];
}
