import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BarChart3, ListOrdered, RefreshCw,
  ChevronRight, Search, ChevronDown, X,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import InsightPanel from '../../components/ui/InsightPanel';
import {
  usePlayerSearch,
  useHittingStats,
  usePitchingStats,
  useMLBRawTeams,
  useTeamRoster,
  useBattingLeaderboard,
  usePitchingLeaderboard,
  useTeamStandings,
} from '../../hooks/useMLBData';
import '../../styles/shared.css';
import './ToolsPage.css';

/* ─── Tool IDs ────────────────────────────────────────────────────── */
type ToolId = 'lineup' | 'team' | 'whatif';

const TOOL_NAV: { id: ToolId; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'lineup', label: 'Lineup Optimizer',  icon: <ListOrdered size={15} /> },
  { id: 'team',   label: 'Team Analyzer',     icon: <BarChart3 size={15} /> },
  { id: 'whatif', label: 'What-If Simulator', icon: <RefreshCw size={15} />, badge: 'BETA' },
];

/* ─── Shared types ────────────────────────────────────────────────── */
interface SelectedPlayer {
  id: number;
  name: string;
  pos: string;
  team: string;
  teamAbbr: string;
  age: number;
}

const PITCHER_POS = new Set(['SP', 'RP', 'P', 'CL', 'TWP']);

const initials = (name: string) =>
  name.split(' ').map(n => n[0] ?? '').filter(Boolean).slice(0, 2).join('');

/* ─── Custom chart tooltip ────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

/* ─── ComparePlayerSlot ───────────────────────────────────────────
   Large inline-search card used by Player Compare and What-If.
   The card IS the search when empty; shows player info when filled.
──────────────────────────────────────────────────────────────── */
function ComparePlayerSlot({
  label,
  color = 'accent',
  selected,
  onSelect,
  onClear,
  war,
  isLoading,
}: {
  label: string;
  color?: 'accent' | 'teal';
  selected: SelectedPlayer | null;
  onSelect: (p: SelectedPlayer) => void;
  onClear: () => void;
  war?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery]     = useState('');
  const [editing, setEditing] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);
  const { data: results = [], isLoading: searching } = usePlayerSearch(query);

  /* Auto-focus input when entering edit mode */
  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  /* Clear selection → go straight to search */
  const handleClear = () => {
    onClear();
    setQuery('');
    setEditing(false);   // slot goes back to empty/search state
  };

  const handleSelect = (p: SelectedPlayer) => {
    onSelect(p);
    setEditing(false);
    setQuery('');
  };

  const isSearching = !selected || editing;
  const colorClass  = color === 'teal' ? 'cps-slot--teal' : 'cps-slot--accent';

  return (
    <div className={`cps-slot ${colorClass} ${selected ? 'cps-slot--filled' : ''}`}>
      <div className="cps-label">{label}</div>

      {/* ── Selected player display ── */}
      {selected && !editing && (
        <div className="cps-player-card">
          <div className="cps-player-avatar">{initials(selected.name)}</div>
          <div className="cps-player-details">
            <span className="cps-player-name">{selected.name}</span>
            <span className="cps-player-meta">
              {selected.pos} · {selected.teamAbbr || selected.team} · Age {selected.age}
            </span>
          </div>
          {war !== undefined && (
            <div className="cps-war-badge">
              <span className="cps-war-val">{war.toFixed(1)}</span>
              <span className="cps-war-lbl">WAR</span>
            </div>
          )}
          <button className="cps-clear-btn" title="Clear" onClick={handleClear}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Search input ── */}
      <div className={`cps-search-wrap ${isSearching ? 'cps-search-wrap--active' : ''}`}>
        <Search size={15} className="cps-search-icon" />
        <input
          ref={inputRef}
          className="cps-search-input"
          placeholder={
            selected && !editing
              ? `Change player…`
              : `Search ${label}…`
          }
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (selected) setEditing(true); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setEditing(false); setQuery(''); }
          }}
        />
        {editing && selected && (
          <button
            className="cps-cancel-btn"
            onClick={() => { setEditing(false); setQuery(''); }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── Results dropdown ── */}
      {isSearching && query.length >= 2 && (
        <div className="cps-results">
          {searching && <div className="cps-results-hint">Searching…</div>}
          {!searching && results.length === 0 && (
            <div className="cps-results-hint">No players found</div>
          )}
          {results.map(p => (
            <button
              key={p.id}
              className="cps-result-row"
              onClick={() =>
                handleSelect({
                  id:       p.id,
                  name:     p.fullName,
                  pos:      p.primaryPosition?.abbreviation ?? '?',
                  team:     p.currentTeam?.name ?? 'Free Agent',
                  teamAbbr: p.currentTeam?.abbreviation ?? '',
                  age:      p.currentAge ?? 0,
                })
              }
            >
              <div className="cps-rr-avatar">{initials(p.fullName)}</div>
              <div className="cps-rr-info">
                <span className="cps-rr-name">{p.fullName}</span>
                <span className="cps-rr-meta">
                  {p.primaryPosition?.abbreviation ?? '?'}{p.currentTeam?.abbreviation ? ` · ${p.currentTeam.abbreviation}` : ''} · {p.currentAge ?? '?'}y
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Empty hint ── */}
      {isSearching && !selected && query.length < 2 && (
        <div className="cps-empty-hint">Start typing to search MLB players</div>
      )}

      {isLoading && selected && !editing && (
        <div className="cps-loading-hint">Loading stats…</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LINEUP OPTIMIZER TOOL
═══════════════════════════════════════════════════════════════════ */
function LineupOptimizerTool() {
  const { teams, isLoading: teamsLoading } = useMLBRawTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const { data: roster = [], isLoading: rosterLoading } = useTeamRoster(selectedTeamId, 'active');
  const { data: batLeaderboard = [] } = useBattingLeaderboard();

  const wobaMap = useMemo(() => {
    const m = new Map<number, number>();
    batLeaderboard.forEach(r => m.set(r.mlbId, r.woba));
    return m;
  }, [batLeaderboard]);

  const warMap = useMemo(() => {
    const m = new Map<number, number>();
    batLeaderboard.forEach(r => m.set(r.mlbId, r.war));
    return m;
  }, [batLeaderboard]);

  const hitters = useMemo(
    () => roster.filter(p => !['SP', 'RP', 'P'].includes(p.position.abbreviation)),
    [roster],
  );

  const [lineup, setLineup] = useState(hitters.slice(0, 9));
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    setLineup(hitters.slice(0, 9));
    setOptimized(false);
  }, [hitters]);

  const totalWar  = lineup.reduce((s, p) => s + (warMap.get(p.person.id)  ?? 0), 0);
  const wobaVals  = lineup.map(p => wobaMap.get(p.person.id) ?? 0).filter(w => w > 0);
  const avgWoba   = wobaVals.length ? wobaVals.reduce((a, b) => a + b, 0) / wobaVals.length : 0;

  const optimize = () => {
    setLineup(prev => [...prev].sort((a, b) => (wobaMap.get(b.person.id) ?? 0) - (wobaMap.get(a.person.id) ?? 0)));
    setOptimized(true);
  };

  return (
    <div className="tool-section">
      <div className="lineup-header">
        <div>
          <div className="tool-section-title">Lineup Optimizer</div>
          <div className="tool-section-sub">Order your lineup for maximum run-scoring probability</div>
        </div>
        <button className="optimize-btn" onClick={optimize} disabled={lineup.length === 0}>
          <RefreshCw size={14} /> Optimize Order
        </button>
      </div>

      {/* Team picker */}
      <div>
        <div className="contract-control-label">Select Team</div>
        <select
          className="tool-select"
          value={selectedTeamId ?? ''}
          onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Choose a team —</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {optimized && (
        <div className="optimize-banner">
          ✅ Lineup optimized by wOBA — highest on-base options at the top.
        </div>
      )}

      {selectedTeamId && rosterLoading && (
        <div className="tool-empty-state">Loading roster…</div>
      )}

      {lineup.length > 0 && (
        <>
          <div className="lineup-summary-row">
            <StatCard label="Total WAR"    value={totalWar.toFixed(1)}              sub="9-man lineup"   color="accent" size="sm" />
            <StatCard label="Avg wOBA"     value={avgWoba > 0 ? avgWoba.toFixed(3) : '—'} sub="Lineup average" color="green"  size="sm" />
            <StatCard label="Spots Filled" value={`${lineup.length}/9`}             sub="Lineup slots"   size="sm" />
          </div>

          <div className="lineup-list">
            {lineup.map((p, i) => {
              const woba = wobaMap.get(p.person.id);
              const war  = warMap.get(p.person.id);
              return (
                <div key={p.person.id} className="lineup-slot">
                  <div className="lineup-order">{i + 1}</div>
                  <div className="lineup-player-avatar">{initials(p.person.fullName)}</div>
                  <div className="lineup-player-info">
                    <span className="lineup-player-name">{p.person.fullName}</span>
                    <span className="lineup-player-meta">
                      {p.position.abbreviation} · {p.person.currentTeam?.abbreviation ?? '—'}
                      {p.person.currentAge ? ` · Age ${p.person.currentAge}` : ''}
                    </span>
                  </div>
                  <div className="lineup-player-stats">
                    {war  !== undefined && <span className="lineup-stat">{war.toFixed(1)} WAR</span>}
                    {woba !== undefined && <span className="lineup-stat accent">{woba.toFixed(3)} wOBA</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!selectedTeamId && (
        <div className="tool-empty-state">Select a team to build and optimize their lineup.</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TEAM ANALYZER TOOL
═══════════════════════════════════════════════════════════════════ */
function TeamAnalyzerTool() {
  const { teams }                                    = useMLBRawTeams();
  const [selectedTeamId, setSelectedTeamId]         = useState<number | null>(null);
  const { data: standingsData }                      = useTeamStandings();
  const { data: roster = [], isLoading: rosterLoad } = useTeamRoster(selectedTeamId);
  const { data: batLb = [] }                         = useBattingLeaderboard();
  const { data: pitLb = [] }                         = usePitchingLeaderboard();

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const teamRecord = useMemo(() => {
    if (!standingsData || !selectedTeamId) return null;
    for (const div of standingsData.records) {
      const found = div.teamRecords.find(r => r.team.id === selectedTeamId);
      if (found) return found;
    }
    return null;
  }, [standingsData, selectedTeamId]);

  const batWarMap = useMemo(() => { const m = new Map<number,number>(); batLb.forEach(r => m.set(r.mlbId, r.war)); return m; }, [batLb]);
  const pitWarMap = useMemo(() => { const m = new Map<number,number>(); pitLb.forEach(r => m.set(r.mlbId, r.war)); return m; }, [pitLb]);

  const getWar = (id: number) => batWarMap.get(id) ?? pitWarMap.get(id) ?? 0;

  const totalWar = roster.reduce((s, p) => s + getWar(p.person.id), 0);
  const ages     = roster.map(p => p.person.currentAge ?? 0).filter(a => a > 0);
  const avgAge   = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => getWar(b.person.id) - getWar(a.person.id)),
    [roster, batWarMap, pitWarMap],
  );

  const leagueChart = useMemo(() => {
    if (!standingsData) return [];
    const rows: { name: string; wins: number; fill: string }[] = [];
    for (const div of standingsData.records) {
      for (const tr of div.teamRecords) {
        const abbr = teams.find(t => t.id === tr.team.id)?.abbreviation
          ?? tr.team.name.split(' ').slice(-1)[0] ?? '';
        rows.push({
          name: abbr,
          wins: tr.wins,
          fill: tr.team.id === selectedTeamId ? '#20b2ff' : 'rgba(32,178,255,0.3)',
        });
      }
    }
    return rows.sort((a, b) => b.wins - a.wins);
  }, [standingsData, selectedTeamId, teams]);

  return (
    <div className="tool-section">
      <div className="team-selector-row">
        <div className="tool-section-title">Team Analyzer</div>
        <select
          className="tool-select"
          value={selectedTeamId ?? ''}
          onChange={e => setSelectedTeamId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Select Team —</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.abbreviation} — {t.name}</option>
          ))}
        </select>
      </div>

      {selectedTeam && (
        <div className="team-hero">
          <div className="team-hero-badge">{selectedTeam.abbreviation}</div>
          <div className="team-hero-info">
            <span className="team-hero-name">{selectedTeam.name}</span>
            <span className="team-hero-meta">
              {selectedTeam.league?.name} · {selectedTeam.division?.name}
              {teamRecord ? ` · ${teamRecord.wins}–${teamRecord.losses}` : ''}
            </span>
          </div>
        </div>
      )}

      {selectedTeam && (
        <div className="stat-grid-4">
          <StatCard label="W-L Record"    value={teamRecord ? `${teamRecord.wins}–${teamRecord.losses}` : '—'} sub="2026 season"             color="accent" size="sm" />
          <StatCard label="Division Rank" value={teamRecord?.divisionRank ?? '—'}                              sub={selectedTeam.division?.name} size="sm" />
          <StatCard label="Tracked WAR"   value={totalWar.toFixed(1)}                                          sub={`${roster.length} players`} color="green" size="sm" />
          <StatCard label="Avg Age"       value={avgAge > 0 ? avgAge.toFixed(1) : '—'}                        sub="40-man roster"              size="sm" />
        </div>
      )}

      {selectedTeamId && rosterLoad && (
        <div className="tool-empty-state">Loading roster…</div>
      )}

      {sortedRoster.length > 0 && (
        <Card title="40-Man Roster" subtitle="Sorted by FanGraphs WAR (current season)">
          <div className="team-roster-list">
            {sortedRoster.map(p => {
              const war = getWar(p.person.id);
              return (
                <div key={p.person.id} className="team-roster-row">
                  <div className="trr-pos">{p.position.abbreviation}</div>
                  <div className="trr-avatar">{initials(p.person.fullName)}</div>
                  <div className="trr-info">
                    <span className="trr-name">{p.person.fullName}</span>
                    <span className="trr-meta">
                      Age {p.person.currentAge ?? '?'} · #{p.jerseyNumber ?? '—'}
                    </span>
                  </div>
                  {war > 0 && (
                    <div className="trr-war">
                      <span>{war.toFixed(1)}</span>
                      <span>WAR</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {leagueChart.length > 0 && (
        <Card title="League Wins" subtitle="2026 season — selected team highlighted">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={leagueChart} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#7f93a8', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4d6070', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="wins" name="Wins" radius={[4, 4, 0, 0]}>
                {leagueChart.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {!selectedTeamId && (
        <div className="tool-empty-state">Select a team to view their roster, standings, and WAR breakdown.</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   WHAT-IF SIMULATOR TOOL
═══════════════════════════════════════════════════════════════════ */
function WhatIfSimulator() {
  const [player, setPlayer] = useState<SelectedPlayer | null>(null);
  const [kAdj,  setKAdj]   = useState(0);
  const [bbAdj, setBbAdj]  = useState(0);
  const [evAdj, setEvAdj]  = useState(0);

  const { stats: base, isLoading } = useHittingStats(player?.id ?? null);

  const simWoba = base ? Math.max(0.2, Math.min(0.55, base.woba + bbAdj * 0.004 - kAdj * 0.003 + evAdj * 0.004)) : 0;
  const simWrc  = base ? Math.round(base.wrcPlus + bbAdj * 2.4 - kAdj * 1.8 + evAdj * 2.8) : 0;
  const simWar  = base ? Math.max(0, Math.round((base.war + (simWoba - base.woba) * 20) * 10) / 10) : 0;

  const handleSelect = (p: SelectedPlayer) => {
    setPlayer(p);
    setKAdj(0);
    setBbAdj(0);
    setEvAdj(0);
  };

  return (
    <div className="tool-section">
      <div className="tool-section-title">What-If Simulator</div>
      <div className="tool-section-sub">Adjust plate discipline and contact quality to project outcomes</div>

      {/* Full-width slot for single player */}
      <ComparePlayerSlot
        label="Select Hitter"
        color="accent"
        selected={player}
        onSelect={handleSelect}
        onClear={() => { setPlayer(null); setKAdj(0); setBbAdj(0); setEvAdj(0); }}
        war={base?.war}
        isLoading={isLoading && player !== null}
      />

      {!player && (
        <div className="tool-empty-state">Search for a hitter above to simulate stat adjustments.</div>
      )}

      {base && (
        <>
          <div className="whatif-sliders">
            {[
              { label: 'K% Δ',        val: kAdj,  set: setKAdj,  min: -10, max: 10, color: '#ef4444', desc: 'Strikeout rate change (pp)' },
              { label: 'BB% Δ',       val: bbAdj, set: setBbAdj, min: -5,  max: 5,  color: '#22c55e', desc: 'Walk rate change (pp)' },
              { label: 'Exit Velo Δ', val: evAdj, set: setEvAdj, min: -6,  max: 6,  color: '#20b2ff', desc: 'Exit velocity change (mph)' },
            ].map(s => (
              <div key={s.label} className="whatif-slider">
                <div className="wis-header">
                  <span className="wis-label">{s.label}</span>
                  <span className="wis-desc">{s.desc}</span>
                  <span className="wis-val" style={{ color: s.color }}>{s.val > 0 ? '+' : ''}{s.val}</span>
                </div>
                <input
                  type="range"
                  min={s.min} max={s.max} value={s.val}
                  onChange={e => s.set(Number(e.target.value))}
                  className="wis-range"
                  style={{ '--thumb-color': s.color } as React.CSSProperties & { '--thumb-color': string }}
                />
              </div>
            ))}
          </div>

          <div className="whatif-result">
            <div className="whatif-result-header">Simulated Outcome</div>
            <div className="whatif-result-grid">
              {[
                { label: 'wOBA', base: base.woba.toFixed(3),     sim: simWoba.toFixed(3), delta: simWoba - base.woba },
                { label: 'wRC+', base: base.wrcPlus.toString(),  sim: simWrc.toString(),  delta: simWrc  - base.wrcPlus },
                { label: 'WAR',  base: base.war.toFixed(1),      sim: simWar.toFixed(1),  delta: simWar  - base.war },
              ].map(r => (
                <div key={r.label} className="whatif-result-item">
                  <span className="wri-label">{r.label}</span>
                  <span className="wri-base">{r.base}</span>
                  <span className="wri-arrow">→</span>
                  <span className="wri-sim">{r.sim}</span>
                  <span className={`wri-delta ${r.delta > 0 ? 'wri-pos' : r.delta < 0 ? 'wri-neg' : ''}`}>
                    {r.delta > 0 ? '+' : ''}
                    {Math.abs(r.delta) < 1 ? r.delta.toFixed(3) : r.delta.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <InsightPanel
            title="Simulation Notes"
            insights={[
              { type: 'info', text: 'Adjustments are additive to baseline stats. Models use linear approximations of wOBA contribution.' },
              { type: 'tip',  text: 'A 3pp walk rate increase with 2 fewer strikeouts typically produces ~+0.015 wOBA and +0.5 WAR.' },
            ]}
          />
        </>
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN TOOLS PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState<ToolId>('lineup');

  const TOOL_COMPONENTS: Record<ToolId, React.ReactNode> = {
    lineup: <LineupOptimizerTool />,
    team:   <TeamAnalyzerTool />,
    whatif: <WhatIfSimulator />,
  };

  return (
    <div className="tools-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Advanced Tools Suite</h1>
          <p className="page-subtitle">Three powerful front-office tools powered by live MLB data</p>
        </div>
        <Badge variant="accent">3 Tools</Badge>
      </div>

      <div className="tools-layout">
        <nav className="tools-nav">
          {TOOL_NAV.map(t => (
            <button
              key={t.id}
              className={`tools-nav-btn ${activeTool === t.id ? 'tools-nav-btn--active' : ''}`}
              onClick={() => setActiveTool(t.id)}
            >
              <span className="tools-nav-icon">{t.icon}</span>
              <span className="tools-nav-label">{t.label}</span>
              {t.badge && (
                <span className={`tools-nav-badge ${t.badge === 'BETA' ? 'tools-nav-badge--beta' : 'tools-nav-badge--new'}`}>
                  {t.badge}
                </span>
              )}
              <ChevronRight size={12} className="tools-nav-arrow" />
            </button>
          ))}
        </nav>

        <div className="tools-content">
          {TOOL_COMPONENTS[activeTool]}
        </div>
      </div>
    </div>
  );
}
