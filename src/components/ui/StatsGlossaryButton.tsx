import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { STAT_GLOSSARY } from './StatTooltip';
import './StatsGlossaryButton.css';

// ─── Category definitions ─────────────────────────────────────────────────────

const CATEGORIES: { label: string; keys: string[] }[] = [
  {
    label: 'Batting',
    keys: ['AVG', 'OBP', 'SLG', 'OPS', 'ISO', 'BABIP'],
  },
  {
    label: 'Advanced Hitting',
    keys: ['wOBA', 'wRC+', 'xwOBA'],
  },
  {
    label: 'Contact Quality',
    keys: ['Exit Velo', 'Barrel %', 'Hard Hit %', 'Sweet Spot%'],
  },
  {
    label: 'Plate Discipline',
    keys: ['BB%', 'K%'],
  },
  {
    label: 'Batted Ball Profile',
    keys: ['GB%', 'FB%', 'LD%', 'Pull%', 'Center%', 'Oppo%'],
  },
  {
    label: 'Pitching',
    keys: ['ERA', 'xERA', 'WHIP', 'FIP', 'K/9', 'BB/9', 'HR/9', 'K-BB%', 'Avg FB', 'Whiff%', 'Chase%'],
  },
  {
    label: 'Defense',
    keys: ['OAA', 'DRS', 'UZR', 'UZR/150', 'Defense', 'FLD%', 'Framing', 'ARM'],
  },
  {
    label: 'Value',
    keys: ['fWAR', 'WPA', 'RE24', 'Clutch'],
  },
  {
    label: 'Game Log',
    keys: ['Season AVG', 'IP', 'PC', 'Dec'],
  },
];

// ─── Glossary panel ───────────────────────────────────────────────────────────

function GlossaryPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  // Auto-focus search on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Build filtered view
  const filtered = CATEGORIES.map(cat => ({
    ...cat,
    entries: cat.keys
      .map(k => ({ key: k, entry: STAT_GLOSSARY[k] }))
      .filter(({ key, entry }) => {
        if (!entry) return false;
        if (!q) return true;
        return (
          key.toLowerCase().includes(q) ||
          entry.name.toLowerCase().includes(q) ||
          entry.desc.toLowerCase().includes(q)
        );
      }),
  })).filter(cat => cat.entries.length > 0);

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="gloss-backdrop" onClick={onClose} aria-hidden />

      {/* Panel */}
      <div className="gloss-panel" role="dialog" aria-label="Stats Glossary">
        {/* Header */}
        <div className="gloss-header">
          <div className="gloss-title-row">
            <span className="gloss-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            <h2 className="gloss-title">Stats Glossary</h2>
          </div>
          <button className="gloss-close" onClick={onClose} aria-label="Close glossary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="gloss-search-wrap">
          <svg className="gloss-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="gloss-search"
            type="text"
            placeholder="Search stats…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="gloss-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        {/* Entries */}
        <div className="gloss-body">
          {filtered.length === 0 && (
            <p className="gloss-empty">No stats match "{query}"</p>
          )}
          {filtered.map(cat => (
            <section key={cat.label} className="gloss-section">
              <h3 className="gloss-section-label">{cat.label}</h3>
              <div className="gloss-entries">
                {cat.entries.map(({ key, entry }) => (
                  <div key={key} className="gloss-entry">
                    <div className="gloss-entry-header">
                      <span className="gloss-entry-abbr">{key}</span>
                      <span className="gloss-entry-name">{entry.name}</span>
                    </div>
                    <p className="gloss-entry-desc">{entry.desc}</p>
                    {entry.context && (
                      <span className="gloss-entry-context">{entry.context}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

// ─── Floating button ──────────────────────────────────────────────────────────

export default function StatsGlossaryButton() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        className="gloss-fab"
        onClick={() => setOpen(true)}
        aria-label="Open stats glossary"
        title="Stats Glossary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <span className="gloss-fab-label">Glossary</span>
      </button>
      {open && <GlossaryPanel onClose={close} />}
    </>
  );
}
