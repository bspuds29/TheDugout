import React, { useState, useMemo } from 'react';
import { STAT_GLOSSARY } from '../../components/ui/StatTooltip';
import '../../styles/shared.css';
import './GlossaryPage.css';

// ─── Category definitions ─────────────────────────────────────────────────────

const CATEGORIES: { label: string; keys: string[] }[] = [
  {
    label: 'Counting Stats',
    keys: ['G', 'GS', 'PA', 'AB', 'H', '1B', '2B', '3B', 'HR', 'R', 'RBI', 'SB', 'BB', 'SO', 'W', 'L', 'SV', 'IP'],
  },
  {
    label: 'Batting',
    keys: ['AVG', 'OBP', 'SLG', 'OPS', 'ISO', 'BABIP', 'wOBA', 'wRC+'],
  },
  {
    label: 'Plate Discipline',
    keys: ['BB%', 'K%', 'BB/K', 'Whiff%', 'Chase%', 'LOB%', 'HR/FB'],
  },
  {
    label: 'Expected Stats',
    keys: ['xwOBA', 'xBA', 'xSLG', 'xISO', 'BA−xBA', 'SLG−xSLG', 'wOBA−xwOBA'],
  },
  {
    label: 'Contact Quality',
    keys: ['Exit Velo', 'Launch Angle', 'Barrel %', 'Hard Hit %', 'Sweet Spot%', 'Sprint Speed'],
  },
  {
    label: 'Batted Ball Profile',
    keys: ['GB%', 'FB%', 'LD%', 'Pull%', 'Center%', 'Oppo%'],
  },
  {
    label: 'Pitching',
    keys: ['ERA', 'xERA', 'WHIP', 'FIP', 'K/9', 'BB/9', 'HR/9', 'K-BB%', 'Avg FB', 'Avg Velo'],
  },
  {
    label: 'Defense',
    keys: ['OAA', 'DRS', 'UZR', 'UZR/150', 'Defense', 'FLD%', 'Framing', 'ARM', 'Inn', 'E', 'A', 'PO'],
  },
  {
    label: 'Value',
    keys: ['fWAR', 'WPA', 'RE24', 'Clutch'],
  },
  {
    label: 'Game Log',
    keys: ['Season AVG', 'PC', 'Dec'],
  },
];

const ALL_KEYS = CATEGORIES.flatMap(c => c.keys);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GlossaryPage() {
  const [query,       setQuery]       = useState('');
  const [activeTab,   setActiveTab]   = useState('All');

  const q = query.trim().toLowerCase();

  const tabs = ['All', ...CATEGORIES.map(c => c.label)];

  const visible = useMemo(() => {
    const baseKeys = activeTab === 'All'
      ? ALL_KEYS
      : (CATEGORIES.find(c => c.label === activeTab)?.keys ?? []);

    return baseKeys
      .map(k => ({ key: k, entry: STAT_GLOSSARY[k] }))
      .filter(({ key, entry }) => {
        if (!entry) return false;
        if (!q) return true;
        return (
          key.toLowerCase().includes(q) ||
          entry.name.toLowerCase().includes(q) ||
          entry.desc.toLowerCase().includes(q)
        );
      });
  }, [activeTab, q]);

  // Group by category when showing All (and not searching)
  const grouped = useMemo(() => {
    if (activeTab !== 'All') return null;
    return CATEGORIES.map(cat => ({
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
  }, [activeTab, q]);

  return (
    <div className="gloss-page">
      {/* ── Header ── */}
      <div className="gloss-page-header">
        <div className="gloss-page-title-row">
          <span className="gloss-page-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </span>
          <div>
            <h1 className="gloss-page-title">Stats Glossary</h1>
            <p className="gloss-page-sub">Definitions and benchmarks for every stat on The Dugout</p>
          </div>
        </div>

        {/* Search */}
        <div className="gloss-page-search-wrap">
          <svg className="gloss-page-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="gloss-page-search"
            type="text"
            placeholder="Search stats…"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveTab('All'); }}
          />
          {query && (
            <button className="gloss-page-search-clear" onClick={() => setQuery('')} aria-label="Clear">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ── */}
      {!query && (
        <div className="gloss-tabs-wrap">
          <div className="gloss-tabs">
            {tabs.map(tab => (
              <button
                key={tab}
                className={`gloss-tab ${activeTab === tab ? 'gloss-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {grouped ? (
        /* All tab — grouped by category */
        <div className="gloss-page-sections">
          {grouped.length === 0 && (
            <p className="gloss-page-empty">No stats match "{query}"</p>
          )}
          {grouped.map(cat => (
            <section key={cat.label} className="gloss-page-section">
              <h2 className="gloss-page-section-label">{cat.label}</h2>
              <div className="gloss-page-grid">
                {cat.entries.map(({ key, entry }) => (
                  <div key={key} className="gloss-card">
                    <div className="gloss-card-head">
                      <span className="gloss-card-abbr">{key}</span>
                      <span className="gloss-card-name">{entry.name}</span>
                    </div>
                    <p className="gloss-card-desc">{entry.desc}</p>
                    {entry.context && (
                      <span className="gloss-card-context">{entry.context}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        /* Single category tab or search results — flat grid */
        <div className="gloss-page-sections">
          {visible.length === 0 && (
            <p className="gloss-page-empty">No stats match "{query}"</p>
          )}
          {visible.length > 0 && (
            <div className="gloss-page-grid">
              {visible.map(({ key, entry }) => (
                <div key={key} className="gloss-card">
                  <div className="gloss-card-head">
                    <span className="gloss-card-abbr">{key}</span>
                    <span className="gloss-card-name">{entry.name}</span>
                  </div>
                  <p className="gloss-card-desc">{entry.desc}</p>
                  {entry.context && (
                    <span className="gloss-card-context">{entry.context}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
