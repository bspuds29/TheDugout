import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Plus } from 'lucide-react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, ResponsiveContainer,
} from 'recharts';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import {
  usePlayerSearch,
  useHittingStats,
  usePitchingStats,
  usePlayer,
} from '../../hooks/useMLBData';
import './ToolsPage.css';

/* ─── Constants ──────────────────────────────────────────────────── */
const MAX_PLAYERS = 4;

const SLOT_COLORS = ['accent', 'teal', 'amber', 'purple'] as const;
type SlotColor = typeof SLOT_COLORS[number];

const RADAR_HEX: Record<SlotColor, string> = {
  accent: '#20b2ff',
  teal:   '#00d4aa',
  amber:  '#f59e0b',
  purple: '#a855f7',
};

/* ─── Types ──────────────────────────────────────────────────────── */
interface SelectedPlayer {
  id: number;
  name: string;
  pos: string;
  team: string;
  teamAbbr: string;
  age: number;
}

interface CompareRow {
  label: string;
  rawValues: number[];
  displayValues: string[];
  lowerIsBetter: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const initials = (name: string) =>
  name.split(' ').map(n => n[0] ?? '').filter(Boolean).slice(0, 2).join('');

const lastName = (name: string) => name.split(' ').slice(-1)[0] ?? name;

function bestIndex(row: CompareRow): number {
  const vals = row.rawValues;
  if (vals.every(v => v === 0)) return -1;
  if (row.lowerIsBetter) {
    const nonZero = vals.filter(v => v > 0);
    if (!nonZero.length) return -1;
    const min = Math.min(...nonZero);
    return vals.indexOf(min);
  }
  const max = Math.max(...vals);
  return vals.indexOf(max);
}

/* ─── ComparePlayerSlot ──────────────────────────────────────────── */
function ComparePlayerSlot({
  label,
  color,
  selected,
  onSelect,
  onClear,
  onRemove,
  canRemove,
  war,
  isLoading,
  resolvedTeamAbbr,
}: {
  label: string;
  color: SlotColor;
  selected: SelectedPlayer | null;
  onSelect: (p: SelectedPlayer) => void;
  onClear: () => void;
  onRemove: () => void;
  canRemove: boolean;
  war?: number;
  isLoading?: boolean;
  resolvedTeamAbbr?: string;
}) {
  const [query, setQuery]     = useState('');
  const [editing, setEditing] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);
  const { data: results = [], isLoading: searching } = usePlayerSearch(query);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  const handleClear = () => { onClear(); setQuery(''); setEditing(false); };
  const handleSelect = (p: SelectedPlayer) => { onSelect(p); setEditing(false); setQuery(''); };
  const isSearching = !selected || editing;
  const colorClass  = `cps-slot--${color}`;

  return (
    <div className={`cps-slot ${colorClass} ${selected ? 'cps-slot--filled' : ''}`}>
      {/* Label */}
      <div className="cps-label-row">
        <span className="cps-label">{label}</span>
      </div>

      {selected && !editing && (
        <div className="cps-player-card">
          <PlayerAvatar mlbId={selected.id} name={selected.name} size={52} className="cps-avatar-img" />
          <div className="cps-player-details">
            <span className="cps-player-name">{selected.name}</span>
            <span className="cps-player-meta">
              {selected.pos}{resolvedTeamAbbr || selected.teamAbbr ? ` · ${resolvedTeamAbbr || selected.teamAbbr}` : ''} · Age {selected.age}
            </span>
          </div>
          {war !== undefined && (
            <div className="cps-war-badge">
              <span className="cps-war-val">{war.toFixed(1)}</span>
              <span className="cps-war-lbl">WAR</span>
            </div>
          )}
          {/* One X: removes the slot when removable, otherwise just clears the player */}
          <button
            className="cps-clear-btn"
            title={canRemove ? 'Remove slot' : 'Clear player'}
            onClick={canRemove ? onRemove : handleClear}
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className={`cps-search-wrap ${isSearching ? 'cps-search-wrap--active' : ''}`}>
        <Search size={15} className="cps-search-icon" />
        <input
          ref={inputRef}
          className="cps-search-input"
          placeholder={selected && !editing ? 'Change player…' : `Search ${label}…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (selected) setEditing(true); }}
          onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setQuery(''); } }}
        />
        {editing && selected && (
          <button className="cps-cancel-btn" onClick={() => { setEditing(false); setQuery(''); }}>
            Cancel
          </button>
        )}
      </div>

      {isSearching && query.length >= 2 && (
        <div className="cps-results">
          {searching && <div className="cps-results-hint">Searching…</div>}
          {!searching && results.length === 0 && <div className="cps-results-hint">No players found</div>}
          {results.map(p => (
            <button
              key={p.id}
              className="cps-result-row"
              onClick={() => handleSelect({
                id:       p.id,
                name:     p.fullName,
                pos:      p.primaryPosition?.abbreviation ?? '?',
                team:     p.currentTeam?.name ?? '',
                teamAbbr: p.currentTeam?.abbreviation ?? '',
                age:      p.currentAge ?? 0,
              })}
            >
              <PlayerAvatar mlbId={p.id} name={p.fullName} size={30} />
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

      {isSearching && !selected && query.length < 2 && (
        <div className="cps-empty-hint">Start typing to search MLB players</div>
      )}

      {isLoading && selected && !editing && (
        <div className="cps-loading-hint">Loading stats…</div>
      )}
    </div>
  );
}

/* ─── PlayerComparePage ──────────────────────────────────────────── */
export default function PlayerComparePage() {
  const [players, setPlayers] = useState<(SelectedPlayer | null)[]>([null, null]);

  // Fixed hook declarations for up to 4 slots (rules of hooks)
  const { stats: hit0, isLoading: hitL0 } = useHittingStats(players[0]?.id ?? null);
  const { stats: hit1, isLoading: hitL1 } = useHittingStats(players[1]?.id ?? null);
  const { stats: hit2, isLoading: hitL2 } = useHittingStats(players[2]?.id ?? null);
  const { stats: hit3, isLoading: hitL3 } = useHittingStats(players[3]?.id ?? null);
  const { stats: pit0, isLoading: pitL0 } = usePitchingStats(players[0]?.id ?? null);
  const { stats: pit1, isLoading: pitL1 } = usePitchingStats(players[1]?.id ?? null);
  const { stats: pit2, isLoading: pitL2 } = usePitchingStats(players[2]?.id ?? null);
  const { stats: pit3, isLoading: pitL3 } = usePitchingStats(players[3]?.id ?? null);
  const { player: person0 } = usePlayer(players[0]?.id ?? null);
  const { player: person1 } = usePlayer(players[1]?.id ?? null);
  const { player: person2 } = usePlayer(players[2]?.id ?? null);
  const { player: person3 } = usePlayer(players[3]?.id ?? null);

  const hitStats  = [hit0, hit1, hit2, hit3].slice(0, players.length);
  const pitStats  = [pit0, pit1, pit2, pit3].slice(0, players.length);
  const persons   = [person0, person1, person2, person3].slice(0, players.length);
  const hitLoads  = [hitL0, hitL1, hitL2, hitL3].slice(0, players.length);
  const pitLoads  = [pitL0, pitL1, pitL2, pitL3].slice(0, players.length);

  // Slot management
  const addSlot    = () => setPlayers(p => [...p, null]);
  const removeSlot = (i: number) => setPlayers(p => p.filter((_, idx) => idx !== i));
  const setPlayer  = (i: number, p: SelectedPlayer | null) =>
    setPlayers(prev => { const next = [...prev]; next[i] = p; return next; });

  const filledPlayers = players.map((p, i) => p ? { ...p, index: i } : null).filter(Boolean) as (SelectedPlayer & { index: number })[];
  const filledCount   = filledPlayers.length;

  // WAR per slot
  const wars = hitStats.map((h, i) => h?.war ?? pitStats[i]?.war ?? 0);

  // Determine mode: all hitters, all pitchers, or mixed
  const allHitting  = filledCount >= 2 && filledPlayers.every((_, i) => hitStats[_.index] !== null);
  const allPitching = !allHitting && filledCount >= 2 && filledPlayers.every((_, i) => pitStats[_.index] !== null);

  // Compare rows (N players)
  const compareRows = useMemo((): CompareRow[] => {
    if (filledCount < 2) return [];

    const filled = filledPlayers;

    if (allHitting) {
      const hs = filled.map(p => hitStats[p.index]!);
      return [
        { label: 'WAR',       rawValues: hs.map(h => h.war),        displayValues: hs.map(h => h.war.toFixed(1)),              lowerIsBetter: false },
        { label: 'AVG',       rawValues: hs.map(h => h.avg),        displayValues: hs.map(h => h.avg.toFixed(3)),              lowerIsBetter: false },
        { label: 'OBP',       rawValues: hs.map(h => h.obp),        displayValues: hs.map(h => h.obp.toFixed(3)),              lowerIsBetter: false },
        { label: 'SLG',       rawValues: hs.map(h => h.slg),        displayValues: hs.map(h => h.slg.toFixed(3)),              lowerIsBetter: false },
        { label: 'wOBA',      rawValues: hs.map(h => h.woba),       displayValues: hs.map(h => h.woba.toFixed(3)),             lowerIsBetter: false },
        { label: 'wRC+',      rawValues: hs.map(h => h.wrcPlus),    displayValues: hs.map(h => h.wrcPlus.toString()),          lowerIsBetter: false },
        { label: 'ISO',       rawValues: hs.map(h => h.iso),        displayValues: hs.map(h => h.iso.toFixed(3)),              lowerIsBetter: false },
        { label: 'Exit Velo', rawValues: hs.map(h => h.exitVelo),   displayValues: hs.map(h => h.exitVelo.toFixed(1)),         lowerIsBetter: false },
        { label: 'Barrel%',   rawValues: hs.map(h => h.barrelPct),  displayValues: hs.map(h => `${h.barrelPct.toFixed(1)}%`),  lowerIsBetter: false },
        { label: 'K%',        rawValues: hs.map(h => h.kPct),       displayValues: hs.map(h => `${h.kPct.toFixed(1)}%`),       lowerIsBetter: true  },
        { label: 'BB%',       rawValues: hs.map(h => h.bbPct),      displayValues: hs.map(h => `${h.bbPct.toFixed(1)}%`),      lowerIsBetter: false },
        { label: 'Sprint Spd', rawValues: hs.map(h => h.sprint),     displayValues: hs.map(h => h.sprint.toFixed(1)),           lowerIsBetter: false },
      ];
    }

    if (allPitching) {
      const ps = filled.map(p => pitStats[p.index]!);
      return [
        { label: 'WAR',    rawValues: ps.map(p => p.war),             displayValues: ps.map(p => p.war.toFixed(1)),              lowerIsBetter: false },
        { label: 'ERA',    rawValues: ps.map(p => p.era),             displayValues: ps.map(p => p.era.toFixed(2)),              lowerIsBetter: true  },
        { label: 'FIP',    rawValues: ps.map(p => p.fip),             displayValues: ps.map(p => p.fip.toFixed(2)),              lowerIsBetter: true  },
        { label: 'xFIP',   rawValues: ps.map(p => p.xfip),            displayValues: ps.map(p => p.xfip.toFixed(2)),             lowerIsBetter: true  },
        { label: 'WHIP',   rawValues: ps.map(p => p.whip),            displayValues: ps.map(p => p.whip.toFixed(2)),             lowerIsBetter: true  },
        { label: 'K/9',    rawValues: ps.map(p => p.k9),              displayValues: ps.map(p => p.k9.toFixed(1)),               lowerIsBetter: false },
        { label: 'BB/9',   rawValues: ps.map(p => p.bb9),             displayValues: ps.map(p => p.bb9.toFixed(1)),              lowerIsBetter: true  },
        { label: 'K%',     rawValues: ps.map(p => p.kPct),            displayValues: ps.map(p => `${p.kPct.toFixed(1)}%`),       lowerIsBetter: false },
        { label: 'BB%',    rawValues: ps.map(p => p.bbPct),           displayValues: ps.map(p => `${p.bbPct.toFixed(1)}%`),      lowerIsBetter: true  },
        { label: 'K-BB%',  rawValues: ps.map(p => p.kBBPct),         displayValues: ps.map(p => `${p.kBBPct.toFixed(1)}%`),     lowerIsBetter: false },
        { label: 'Whiff%', rawValues: ps.map(p => p.whiffPct),        displayValues: ps.map(p => `${p.whiffPct.toFixed(1)}%`),   lowerIsBetter: false },
        { label: 'IP',     rawValues: ps.map(p => p.inningsPitched),  displayValues: ps.map(p => p.inningsPitched.toFixed(1)),   lowerIsBetter: false },
      ];
    }

    // Mixed / fallback: just WAR
    if (wars.filter(w => w > 0).length >= 2) {
      const filled2 = players.map((p, i) => ({ p, i })).filter(x => x.p !== null);
      return [{ label: 'WAR', rawValues: filled2.map(x => wars[x.i]), displayValues: filled2.map(x => wars[x.i].toFixed(1)), lowerIsBetter: false }];
    }
    return [];
  }, [filledPlayers, hitStats, pitStats, allHitting, allPitching, wars, players, filledCount]);

  // Radar: filter out players with no Statcast data (exitVelo/whiffPct = 0 means no Savant data)
  const radarEligible = useMemo(() => {
    if (allHitting)  return filledPlayers.filter(p => (hitStats[p.index]?.exitVelo ?? 0) > 0);
    if (allPitching) return filledPlayers.filter(p => (pitStats[p.index]?.whiffPct ?? 0) > 0);
    return [];
  }, [filledPlayers, hitStats, pitStats, allHitting, allPitching]);

  const radarExcluded = useMemo(() =>
    filledPlayers.filter(p => !radarEligible.includes(p)),
  [filledPlayers, radarEligible]);

  // Radar data (2–4 players)
  const radarData = useMemo(() => {
    if (radarEligible.length < 2) return [];
    const filled = radarEligible;

    if (allHitting) {
      const hs = filled.map(p => hitStats[p.index]!);
      const maxWar = Math.max(...hs.map(h => h.war), 1);
      return [
        { stat: 'wOBA',     ...Object.fromEntries(filled.map((p, i) => [i, Math.min(100, (hs[i].woba / 0.450) * 100)])) },
        { stat: 'Exit V',   ...Object.fromEntries(filled.map((p, i) => [i, Math.min(100, ((hs[i].exitVelo - 82) / 16) * 100)])) },
        { stat: 'Barrel',   ...Object.fromEntries(filled.map((p, i) => [i, Math.min(100, (hs[i].barrelPct / 20) * 100)])) },
        { stat: 'BB%',      ...Object.fromEntries(filled.map((p, i) => [i, Math.min(100, (hs[i].bbPct / 18) * 100)])) },
        { stat: 'K% (inv)', ...Object.fromEntries(filled.map((p, i) => [i, Math.max(0, 100 - (hs[i].kPct / 30) * 100)])) },
        { stat: 'WAR',      ...Object.fromEntries(filled.map((p, i) => [i, Math.round((hs[i].war / maxWar) * 100)])) },
      ];
    }
    if (allPitching) {
      const ps = filled.map(p => pitStats[p.index]!);
      const maxWar = Math.max(...ps.map(p => p.war), 1);
      return [
        { stat: 'ERA',       ...Object.fromEntries(filled.map((p, i) => [i, Math.max(0, 100 - (ps[i].era / 5) * 100)])) },
        { stat: 'K%',        ...Object.fromEntries(filled.map((p, i) => [i, Math.min(100, (ps[i].kPct / 35) * 100)])) },
        { stat: 'BB% (inv)', ...Object.fromEntries(filled.map((p, i) => [i, Math.max(0, 100 - (ps[i].bbPct / 12) * 100)])) },
        { stat: 'Whiff%',    ...Object.fromEntries(filled.map((p, i) => [i, Math.min(100, (ps[i].whiffPct / 35) * 100)])) },
        { stat: 'WHIP (inv)',...Object.fromEntries(filled.map((p, i) => [i, Math.max(0, 100 - (ps[i].whip / 2) * 100)])) },
        { stat: 'WAR',       ...Object.fromEntries(filled.map((p, i) => [i, Math.round((ps[i].war / maxWar) * 100)])) },
      ];
    }
    return [];
  }, [radarEligible, hitStats, pitStats, allHitting, allPitching]);

  const gridCols = `160px repeat(${filledCount}, 1fr)`;

  return (
    <div className="tools-page">
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Player Compare</h1>
          <p className="page-subtitle">Side-by-side stat comparison across up to {MAX_PLAYERS} MLB players</p>
          {players.length < MAX_PLAYERS && (
            <button className="cps-add-btn-inline" onClick={addSlot}>
              <Plus size={13} />
              Add Player
            </button>
          )}
        </div>
        <div className="page-header-right">
          <Badge variant="teal">Live Data</Badge>
        </div>
      </div>

      <div className="tool-section">
        {/* Slots row */}
        <div className="compare-slots-row">
          {players.map((p, i) => (
            <React.Fragment key={i}>
              {i === 1 && players.length === 2 && (
                <div className="compare-slots-vs">VS</div>
              )}
              <ComparePlayerSlot
                label={`Player ${String.fromCharCode(65 + i)}`}
                color={SLOT_COLORS[i]}
                selected={p}
                onSelect={sel => setPlayer(i, sel)}
                onClear={() => setPlayer(i, null)}
                onRemove={() => removeSlot(i)}
                canRemove={players.length > 2}
                war={wars[i] || undefined}
                isLoading={players[i] !== null && hitLoads[i] && pitLoads[i]}
                resolvedTeamAbbr={persons[i]?.teamAbbr}
              />
            </React.Fragment>
          ))}
        </div>

        {/* Compare table */}
        {compareRows.length > 0 && filledCount >= 2 && (
          <div className="compare-table">
            {/* Headshot row */}
            <div className="compare-headshot-row" style={{ gridTemplateColumns: gridCols }}>
              <div className="compare-headshot-spacer" />
              {filledPlayers.map((p, i) => (
                <div key={i} className="compare-headshot-cell">
                  <PlayerAvatar mlbId={p.id} name={p.name} size={100} className="compare-headshot-img" />
                  <span className={`compare-headshot-name compare-th--${SLOT_COLORS[p.index]}`}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Rows */}
            {compareRows.map(row => {
              const best = bestIndex(row);
              return (
                <div key={row.label} className="compare-row" style={{ gridTemplateColumns: gridCols }}>
                  <span className="compare-metric">{row.label}</span>
                  {row.displayValues.map((val, i) => (
                    <span
                      key={i}
                      className={`compare-val ${i === best ? `compare-val--winner compare-val--${SLOT_COLORS[filledPlayers[i].index]}` : ''}`}
                    >
                      {val}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Radar chart */}
        {radarData.length > 0 && radarEligible.length >= 2 && (
          <Card
            title="Skill Radar"
            subtitle={allPitching ? 'Normalized 0–100 across pitching dimensions' : 'Normalized 0–100 across offensive dimensions'}
          >
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                <PolarGrid stroke="rgba(255,255,255,0.07)" />
                <PolarAngleAxis dataKey="stat" tick={{ fill: '#7f93a8', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                {radarEligible.map((p, i) => (
                  <Radar
                    key={i}
                    name={lastName(p.name)}
                    dataKey={String(i)}
                    stroke={RADAR_HEX[SLOT_COLORS[p.index]]}
                    fill={RADAR_HEX[SLOT_COLORS[p.index]]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#7f93a8' }} />
              </RadarChart>
            </ResponsiveContainer>
            {radarExcluded.length > 0 && (
              <p className="radar-excluded-note">
                {radarExcluded.map(p => lastName(p.name)).join(', ')} excluded — no Statcast data available
              </p>
            )}
          </Card>
        )}

        {/* Empty state */}
        {filledCount === 0 && (
          <div className="tool-empty-state">
            Search for players above to compare their stats side-by-side
          </div>
        )}
      </div>
    </div>
  );
}
