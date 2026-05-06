import React, { useState, useRef, useEffect } from 'react';
import { Search, Menu, Sun, Moon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayerSearch } from '../../hooks/useMLBData';
import PlayerAvatar from '../ui/PlayerAvatar';
import './TopBar.css';

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('dugout-theme') as 'dark' | 'light') ?? 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dugout-theme', theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}

interface TopBarProps {
  onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);
  const navigate              = useNavigate();
  const location              = useLocation();
  const { theme, toggle }     = useTheme();

  const { data: results = [], isFetching } = usePlayerSearch(query);

  // Close dropdown when clicking outside the search container
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleSelect = (id: number, name: string) => {
    const dest = '/player';
    navigate(`${dest}?mlbId=${id}&name=${encodeURIComponent(name)}`);
    setQuery('');
    setFocused(false);
  };

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuToggle}>
        <Menu size={20} />
      </button>

      {/* Global MLB search */}
      <div
        ref={containerRef}
        className={`topbar-search ${focused ? 'topbar-search--focused' : ''}`}
      >
        <Search size={14} className="topbar-search-icon" />
        <input
          type="text"
          placeholder="Search any MLB player…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          className="topbar-search-input"
        />
        {isFetching && <span className="topbar-search-spinner" />}
        {query && !isFetching && (
          <button className="topbar-search-clear" onClick={() => { setQuery(''); setFocused(false); }}>×</button>
        )}
        {!query && !isFetching && (
          <span className="topbar-search-kbd" title="Open command palette" aria-hidden>
            <kbd>⌘</kbd><kbd>K</kbd>
          </span>
        )}

        {focused && results.length > 0 && (
          <div className="topbar-search-dropdown">
            {results.slice(0, 7).map(p => (
              <button
                key={p.id}
                className="topbar-search-result"
                onMouseDown={() => handleSelect(p.id, p.fullName)}
              >
                <PlayerAvatar mlbId={p.id} name={p.fullName} size={28} />
                <span className="topbar-result-name">{p.fullName}</span>
                <span className="topbar-result-team">{p.currentTeam?.abbreviation ?? '—'}</span>
                <span className="topbar-result-position">{p.primaryPosition?.abbreviation ?? '—'}</span>
              </button>
            ))}
          </div>
        )}

        {focused && query.length >= 2 && results.length === 0 && !isFetching && (
          <div className="topbar-search-dropdown">
            <div className="topbar-search-empty">No players found</div>
          </div>
        )}
      </div>

      {/* Right section */}
      <div className="topbar-right">
        <div className="topbar-season-tag">
          <span className="topbar-season-dot" />
          <span>{new Date().getFullYear()} MLB</span>
        </div>

        <button
          className="topbar-icon-btn topbar-theme-btn"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
