import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search, ArrowUpDown, CornerDownLeft, X,
  LayoutDashboard, TrendingUp, BarChart2, Shield, Zap,
  Trophy, Building2, ArrowLeftRight, Users, Wrench, BookOpen,
  Clock, Star, Hash,
} from 'lucide-react';
import { usePlayerSearch } from '../../hooks/useMLBData';
import { useRecentPlayers, useFavorites } from '../../hooks/usePlayerLists';
import PlayerAvatar from './PlayerAvatar';
import './CommandPalette.css';

// ─── Page navigation entries ─────────────────────────────────────────────────

interface PageEntry {
  label: string;
  path: string;
  icon: React.ReactNode;
  keywords?: string;
}

const PAGES: PageEntry[] = [
  { label: 'Dashboard',         path: '/',              icon: <LayoutDashboard size={15} />, keywords: 'home overview' },
  { label: 'Player Stats',      path: '/player',        icon: <TrendingUp     size={15} />, keywords: 'profile' },
  { label: 'Stats Hub',         path: '/stats',         icon: <Hash           size={15} />, keywords: 'all stats' },
  { label: 'Leaderboard',       path: '/leaderboard',   icon: <BarChart2      size={15} />, keywords: 'leaders rankings' },
  { label: 'Defense',           path: '/defense',       icon: <Shield         size={15} />, keywords: 'fielding oaa drs' },
  { label: 'Clutch Analytics',  path: '/clutch',        icon: <Zap            size={15} />, keywords: 'high leverage' },
  { label: 'Standings',         path: '/standings',     icon: <Trophy         size={15} />, keywords: 'division wild card' },
  { label: 'Team Stats',        path: '/team-stats',    icon: <Building2      size={15} />, keywords: 'teams' },
  { label: 'Trade Analyzer',    path: '/trade',         icon: <ArrowLeftRight size={15} />, keywords: 'trade fairness' },
  { label: 'Player Compare',    path: '/tools/compare', icon: <Users          size={15} />, keywords: 'compare versus vs' },
  { label: 'Advanced Tools',    path: '/tools',         icon: <Wrench         size={15} />, keywords: 'lineup what-if simulator' },
  { label: 'Stats Glossary',    path: '/glossary',      icon: <BookOpen       size={15} />, keywords: 'definitions help' },
];

// ─── Item types for keyboard nav ─────────────────────────────────────────────

type Item =
  | { kind: 'page';   page: PageEntry }
  | { kind: 'recent'; id: number; name: string; teamAbbr?: string; position?: string }
  | { kind: 'fav';    id: number; name: string; teamAbbr?: string; position?: string }
  | { kind: 'result'; id: number; name: string; teamAbbr?: string; position?: string };

// ─── Hook: cmd+K trigger ─────────────────────────────────────────────────────

function useCmdK(onTrigger: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onTrigger();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onTrigger]);
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const navigate = useNavigate();

  const { recent, addRecent } = useRecentPlayers();
  const { favorites } = useFavorites();
  const { data: searchResults = [], isFetching } = usePlayerSearch(query);

  useCmdK(() => setOpen(prev => !prev));

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIdx(0);
  }, []);

  // Auto-focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0); }, [query]);

  // Build unified items list — query mode shows search results, otherwise pages + recents/favs
  const { sections, items } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sections: { label: string; items: Item[] }[] = [];

    if (q.length >= 2) {
      // Search mode — show player results + matching pages
      const matchingPages = PAGES.filter(p =>
        p.label.toLowerCase().includes(q) ||
        p.keywords?.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q)
      );
      if (matchingPages.length > 0) {
        sections.push({
          label: 'Pages',
          items: matchingPages.map(p => ({ kind: 'page', page: p })),
        });
      }
      const playerItems: Item[] = searchResults.slice(0, 8).map(p => ({
        kind: 'result',
        id: p.id,
        name: p.fullName,
        teamAbbr: p.currentTeam?.abbreviation,
        position: p.primaryPosition?.abbreviation,
      }));
      if (playerItems.length > 0) {
        sections.push({ label: 'Players', items: playerItems });
      }
    } else {
      // Idle mode — show favorites, recents, and all pages
      if (favorites.length > 0) {
        sections.push({
          label: 'Watchlist',
          items: favorites.slice(0, 6).map(f => ({
            kind: 'fav',
            id: f.id,
            name: f.name,
            teamAbbr: f.teamAbbr,
            position: f.position,
          })),
        });
      }
      if (recent.length > 0) {
        sections.push({
          label: 'Recently Viewed',
          items: recent.slice(0, 6).map(r => ({
            kind: 'recent',
            id: r.id,
            name: r.name,
            teamAbbr: r.teamAbbr,
            position: r.position,
          })),
        });
      }
      sections.push({
        label: 'Go to Page',
        items: PAGES.map(p => ({ kind: 'page', page: p })),
      });
    }

    const flat = sections.flatMap(s => s.items);
    return { sections, items: flat };
  }, [query, searchResults, recent, favorites]);

  // Activate selected item
  const activate = useCallback((item: Item) => {
    if (item.kind === 'page') {
      navigate(item.page.path);
    } else {
      // Player navigation — also save to recent
      addRecent({
        id: item.id,
        name: item.name,
        teamAbbr: item.teamAbbr,
        position: item.position,
      });
      navigate(`/player?mlbId=${item.id}&name=${encodeURIComponent(item.name)}`);
    }
    close();
  }, [navigate, addRecent, close]);

  // Keyboard handling
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => (items.length === 0 ? 0 : (i + 1) % items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[selectedIdx];
        if (item) activate(item);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, items, selectedIdx, activate, close]);

  // Scroll selected into view
  useEffect(() => {
    const el = itemRefs.current.get(selectedIdx);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  let runningIdx = 0;

  return createPortal(
    <>
      <div className="cmdk-backdrop" onClick={close} aria-hidden />
      <div className="cmdk-shell" role="dialog" aria-label="Command palette">
        {/* Search input */}
        <div className="cmdk-input-row">
          <Search size={16} className="cmdk-input-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder="Search players or jump to a page…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {isFetching && query.length >= 2 && <span className="cmdk-spinner" />}
          <button className="cmdk-close" onClick={close} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="cmdk-body">
          {items.length === 0 && (
            <p className="cmdk-empty">
              {query.length >= 2 ? 'No matches' : 'Type to search players or pages'}
            </p>
          )}
          {sections.map(section => (
            <div key={section.label} className="cmdk-section">
              <div className="cmdk-section-label">
                {section.label === 'Watchlist'        && <Star  size={10} />}
                {section.label === 'Recently Viewed'  && <Clock size={10} />}
                {section.label}
              </div>
              <div className="cmdk-section-items">
                {section.items.map(item => {
                  const idx = runningIdx++;
                  const selected = idx === selectedIdx;
                  return (
                    <button
                      key={`${item.kind}-${item.kind === 'page' ? item.page.path : item.id}`}
                      ref={el => { if (el) itemRefs.current.set(idx, el); }}
                      className={`cmdk-item ${selected ? 'cmdk-item--selected' : ''}`}
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => activate(item)}
                    >
                      <span className="cmdk-item-icon">
                        {item.kind === 'page' && item.page.icon}
                        {item.kind !== 'page' && (
                          <PlayerAvatar mlbId={item.id} name={item.name} size={22} />
                        )}
                      </span>
                      <span className="cmdk-item-label">
                        {item.kind === 'page' ? item.page.label : item.name}
                      </span>
                      {item.kind !== 'page' && (
                        <span className="cmdk-item-meta">
                          {item.position && <span className="cmdk-item-pos">{item.position}</span>}
                          {item.teamAbbr && <span className="cmdk-item-team">{item.teamAbbr}</span>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className="cmdk-footer">
          <span className="cmdk-hint"><ArrowUpDown size={11} /> navigate</span>
          <span className="cmdk-hint"><CornerDownLeft size={11} /> select</span>
          <span className="cmdk-hint"><kbd>esc</kbd> close</span>
        </div>
      </div>
    </>,
    document.body
  );
}
