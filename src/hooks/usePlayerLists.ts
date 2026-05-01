import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

// ─── Stored player shape ─────────────────────────────────────────────────────

export interface StoredPlayer {
  id: number;
  name: string;
  teamAbbr?: string;
  position?: string;
  /** ISO timestamp of when this entry was added/updated */
  addedAt: string;
}

const RECENT_KEY    = 'dugout-recent-players';
const FAVORITES_KEY = 'dugout-favorite-players';
const RECENT_MAX    = 10;

// ─── Recently viewed ─────────────────────────────────────────────────────────

export function useRecentPlayers() {
  const [recent, setRecent] = useLocalStorage<StoredPlayer[]>(RECENT_KEY, []);

  const addRecent = useCallback((p: Omit<StoredPlayer, 'addedAt'>) => {
    if (!p.id || !p.name) return;
    setRecent(prev => {
      const filtered = prev.filter(r => r.id !== p.id);
      const next: StoredPlayer = { ...p, addedAt: new Date().toISOString() };
      return [next, ...filtered].slice(0, RECENT_MAX);
    });
  }, [setRecent]);

  const clearRecent = useCallback(() => setRecent([]), [setRecent]);

  return { recent, addRecent, clearRecent };
}

// ─── Favorites / Watchlist ───────────────────────────────────────────────────

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<StoredPlayer[]>(FAVORITES_KEY, []);

  const isFavorite = useCallback(
    (id: number) => favorites.some(f => f.id === id),
    [favorites]
  );

  const toggleFavorite = useCallback((p: Omit<StoredPlayer, 'addedAt'>) => {
    if (!p.id || !p.name) return;
    setFavorites(prev => {
      const exists = prev.some(f => f.id === p.id);
      if (exists) return prev.filter(f => f.id !== p.id);
      return [{ ...p, addedAt: new Date().toISOString() }, ...prev];
    });
  }, [setFavorites]);

  const removeFavorite = useCallback((id: number) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  }, [setFavorites]);

  return { favorites, isFavorite, toggleFavorite, removeFavorite };
}
