import React, { useState, useMemo, useCallback } from 'react';
import { X, ChevronDown, Check, Plus, Search } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import TeamLogo from '../../components/ui/TeamLogo';
import PlayerHeadshot from '../../components/ui/PlayerHeadshot';
import {
  useBattingLeaderboard,
  usePitchingLeaderboard,
  useBattingLeaderboardByYear,
  usePitchingLeaderboardByYear,
  useMLBRawTeams,
  useTeamRoster,
  useProspectSearch,
  type RawMLBRosterPlayerHydrated,
} from '../../hooks/useMLBData';
import type { FanGraphsBatterRow, FanGraphsPitcherRow } from '../../data/api/fangraphs';
import type { RawMLBTeam, RawMLBSearchResult } from '../../data/api/mlbStats';
import { PROSPECT_DATA, PROSPECT_TIERS } from '../../data/prospectTiers';
import type { ProspectEntry } from '../../data/prospectTiers';
import { lookupContract, formatSalary, statusLabel } from '../../data/contractData';
import '../../styles/shared.css';
import './TradeAnalyzerPage.css';

const YEAR = new Date().getFullYear();

// ─── Types ────────────────────────────────────────────────────────────

export type ProspectGrade = 'top10' | 'top25' | 'top50' | 'top100' | 'other';

interface TradePlayer {
  mlbId:          number;
  name:           string;
  team:           string;
  teamId:         number;
  pos:            string;
  age:            number;
  war:            number;
  projWar:        number;
  pa?:            number;
  ip?:            number;
  wrcPlus?:       number;
  woba?:          number;
  era?:           number;
  fip?:           number;
  type:           'bat' | 'pit' | 'prospect' | 'unknown';
  prospectGrade?: ProspectGrade;
  level?:         string;
}

// ─── Prospect grade definitions ───────────────────────────────────────

const GRADE_LABEL: Record<ProspectGrade, string> = {
  top10:  'Top 10',
  top25:  'Top 25',
  top50:  'Top 50',
  top100: 'Top 100',
  other:  'Other',
};

const GRADE_COLOR: Record<ProspectGrade, string> = {
  top10:  '#a855f7',
  top25:  '#3b82f6',
  top50:  '#22c55e',
  top100: '#f59e0b',
  other:  '#94a3b8',
};

/**
 * Prospect expected value: peak WAR/yr × hit-rate
 * Calibrated to real MLB trade markets (2023–2026 comps):
 *   Top 10:  6.5 WAR × 64% = 4.16 eff WAR → ~$40M at age 21   (Chourio, Holliday tier)
 *   Top 25:  5.0 WAR × 52% = 2.60 eff WAR → ~$25M at age 21
 *   Top 50:  4.0 WAR × 42% = 1.68 eff WAR → ~$16M at age 21
 *   Top 100: 3.0 WAR × 35% = 1.05 eff WAR → ~$10M at age 21
 *   Other:   1.5 WAR × 21% = 0.32 eff WAR → ~$3M  at age 21
 */
const PROSPECT_EFF_WAR:  Record<ProspectGrade, number> = { top10: 4.16, top25: 2.60, top50: 1.68, top100: 1.05, other: 0.32 };
const PROSPECT_PEAK_WAR: Record<ProspectGrade, number> = { top10: 6.5,  top25: 5.0,  top50: 4.0,  top100: 3.0,  other: 1.5  };
const PROSPECT_HIT_RATE: Record<ProspectGrade, number> = { top10: 0.64, top25: 0.52, top50: 0.42, top100: 0.35, other: 0.21 };

function gradeFromAge(age: number): ProspectGrade {
  if (age > 0 && age <= 19) return 'top25';
  if (age <= 21)            return 'top50';
  if (age <= 23)            return 'top100';
  return 'other';
}

function gradeForPlayer(mlbId: number, age: number): ProspectGrade {
  return PROSPECT_TIERS[mlbId] ?? gradeFromAge(age);
}

// ─── Marcel-style multi-season projection ────────────────────────────

const BATTER_FULL_PA   = 550;
const PITCHER_FULL_IP  = 170;
const LEAGUE_MEAN_WAR  = 1.5;   // average WAR for a qualifying roster player
const REGRESSION_WT    = 2;     // Marcel regression anchor (≈ 2 league-avg seasons)

// Prior-season Marcel weights: [y-1, y-2, y-3]
const PRIOR_WEIGHTS = [5, 4, 3];

// Bayesian in-season update: how many "equivalent PA/IP" the Marcel prior counts as.
// A full 550-PA season of prior Marcel is worth ~300 PA of in-season evidence.
const BAT_PRIOR_PA = 300;
const PIT_PRIOR_IP = 120;

/**
 * Age-curve delta applied AFTER regression.
 * Young players are typically still ascending; veterans declining.
 */
function ageCurveDelta(age: number): number {
  if (age <= 0)  return 0;
  if (age <= 22) return +0.4;
  if (age <= 24) return +0.2;
  if (age <= 27) return  0.0;
  if (age <= 29) return -0.1;
  if (age <= 31) return -0.3;
  if (age <= 33) return -0.5;
  return -0.8;
}

/**
 * Build per-player projected WAR maps for batters and pitchers.
 *
 * Two-step approach:
 *   1. Marcel prior: weighted avg of prior 3 full seasons + regression to mean
 *   2. Bayesian in-season update: blend Marcel prior with current-year per-PA/IP rate.
 *      The more current-year volume accumulates, the more current performance dominates.
 *
 * This ensures late-season data (e.g. a player having a terrible year) properly
 * overrides a strong prior history rather than being diluted by fixed season weights.
 */
function buildProjectionMaps(
  batSeasons: FanGraphsBatterRow[][],
  pitSeasons: FanGraphsPitcherRow[][],
): { batProj: Map<number, number>; pitProj: Map<number, number> } {
  // batSeasons[0] = current year, [1..3] = prior years (same for pit)
  const batByYear = batSeasons.map(s => new Map(s.map(r => [r.mlbId, r])));
  const pitByYear = pitSeasons.map(s => new Map(s.map(r => [r.mlbId, r])));

  const allBatIds = new Set(batSeasons.flat().map(r => r.mlbId));
  const allPitIds = new Set(pitSeasons.flat().map(r => r.mlbId));

  function marcellBatter(id: number): number {
    let wSum = 0, wTotal = 0;
    for (let i = 1; i <= 3; i++) {
      const r = batByYear[i]?.get(id);
      if (!r) continue;
      wSum   += r.war * PRIOR_WEIGHTS[i - 1];
      wTotal += PRIOR_WEIGHTS[i - 1];
    }
    if (wTotal === 0) return LEAGUE_MEAN_WAR; // pure rookie — regress fully to mean
    return (wSum + LEAGUE_MEAN_WAR * REGRESSION_WT) / (wTotal + REGRESSION_WT);
  }

  function marcelPitcher(id: number): number {
    let wSum = 0, wTotal = 0;
    for (let i = 1; i <= 3; i++) {
      const r = pitByYear[i]?.get(id);
      if (!r) continue;
      wSum   += r.war * PRIOR_WEIGHTS[i - 1];
      wTotal += PRIOR_WEIGHTS[i - 1];
    }
    if (wTotal === 0) return LEAGUE_MEAN_WAR;
    return (wSum + LEAGUE_MEAN_WAR * REGRESSION_WT) / (wTotal + REGRESSION_WT);
  }

  function projectBatter(id: number): number {
    const prior    = marcellBatter(id);
    const priorRate = prior / BATTER_FULL_PA;          // WAR per PA
    const curr     = batByYear[0]?.get(id);
    const currPA   = curr?.pa ?? 0;
    if (currPA < 30) return Math.max(0, prior);        // too few PAs — trust prior
    const currRate = curr!.war / currPA;               // current-year WAR per PA
    // Bayesian blend: more current PA → current rate dominates
    const updatedRate = (currRate * currPA + priorRate * BAT_PRIOR_PA) / (currPA + BAT_PRIOR_PA);
    return Math.max(0, updatedRate * BATTER_FULL_PA);
  }

  function projectPitcher(id: number): number {
    const prior     = marcelPitcher(id);
    const priorRate = prior / PITCHER_FULL_IP;
    const curr      = pitByYear[0]?.get(id);
    const currIP    = curr?.ip ?? 0;
    if (currIP < 15) return Math.max(0, prior);
    const currRate  = curr!.war / currIP;
    const updatedRate = (currRate * currIP + priorRate * PIT_PRIOR_IP) / (currIP + PIT_PRIOR_IP);
    return Math.max(0, updatedRate * PITCHER_FULL_IP);
  }

  const batProj = new Map([...allBatIds].map(id => [id, projectBatter(id)]));
  const pitProj = new Map([...allPitIds].map(id => [id, projectPitcher(id)]));
  return { batProj, pitProj };
}

// ─── Trade value ──────────────────────────────────────────────────────

/** Premium for controlled years — younger = more surplus value */
function ageFactor(age: number): number {
  if (age > 0 && age < 25) return 1.40;
  if (age < 27)            return 1.20;
  if (age < 30)            return 1.00;
  if (age < 33)            return 0.80;
  return 0.65;
}

/** Positional scarcity multiplier — scarce positions command a premium */
function posScarcity(pos: string): number {
  const p = pos.toUpperCase();
  if (p === 'C')                  return 1.20;
  if (p === 'SS')                 return 1.20;
  if (p === 'CF')                 return 1.15;
  if (p === '2B' || p === '3B')   return 1.10;
  if (p === 'SP')                 return 1.10;
  if (p === '1B' || p === 'DH')   return 0.90;
  if (p === 'RP')                 return 0.85;
  return 1.00;
}

/**
 * All values in $M at ≈$8M/WAR free-agent market rate.
 * MLB players: projWAR × ageFactor × posScarcity × $8M
 * Prospects:   effectiveWAR × ageFactor × $8M
 */
function tradeValue(p: TradePlayer): number {
  if (p.type === 'prospect') {
    const effWAR = PROSPECT_EFF_WAR[p.prospectGrade ?? 'top100'];
    return effWAR * ageFactor(p.age > 0 ? p.age : 21) * 8;
  }
  return Math.max(0, p.projWar * ageFactor(p.age) * posScarcity(p.pos) * 8);
}

function analyzeTrade(s1: TradePlayer[], s2: TradePlayer[]) {
  const s1ProjWar = s1.filter(p => p.type !== 'prospect').reduce((t, p) => t + p.projWar, 0);
  const s2ProjWar = s2.filter(p => p.type !== 'prospect').reduce((t, p) => t + p.projWar, 0);
  const s1Val = s1.reduce((t, p) => t + tradeValue(p), 0);
  const s2Val = s2.reduce((t, p) => t + tradeValue(p), 0);
  const maxVal = Math.max(s1Val, s2Val, 1);
  const score  = Math.round(((s1Val - s2Val) / maxVal) * 100);
  return {
    s1ProjWar: Math.round(s1ProjWar * 10) / 10,
    s2ProjWar: Math.round(s2ProjWar * 10) / 10,
    s1Val:     Math.round(s1Val * 10) / 10,
    s2Val:     Math.round(s2Val * 10) / 10,
    warDelta:  Math.round((s1ProjWar - s2ProjWar) * 10) / 10,
    fairness:  Math.max(-100, Math.min(100, score)),
  };
}

// ─── Fairness meter ───────────────────────────────────────────────────

function FairnessMeter({ score, labelA, labelB }: { score: number; labelA: string; labelB: string }) {
  const abs    = Math.abs(score);
  const isLeft = score > 0;
  const pct    = Math.min(abs, 100);
  let verdict = 'FAIR TRADE', color = '#22c55e';
  if (abs > 25) { verdict = isLeft ? `FAVORS ${labelA}` : `FAVORS ${labelB}`; color = '#f59e0b'; }
  if (abs > 50) { verdict = isLeft ? `HEAVILY FAVORS ${labelA}` : `HEAVILY FAVORS ${labelB}`; color = '#ef4444'; }

  return (
    <div className="fairness-meter">
      <div className="fairness-title">Trade Fairness</div>
      <div className="fairness-track">
        <div className="fairness-label-left">{labelA}</div>
        <div className="fairness-bar-wrap">
          <div className="fairness-bar-bg">
            <div className="fairness-bar-fill"
              style={{ width: `${pct}%`, left: isLeft ? '50%' : `${50 - pct}%`, background: color }} />
            <div className="fairness-center-line" />
          </div>
          <div className="fairness-marker" style={{ left: `calc(50% + ${isLeft ? pct : -pct}%)`, borderColor: color }}>
            <span style={{ color }}>{score > 0 ? '+' : ''}{score}%</span>
          </div>
        </div>
        <div className="fairness-label-right">{labelB}</div>
      </div>
      <div className="fairness-verdict" style={{ color }}>{verdict}</div>
    </div>
  );
}

// ─── Team picker ──────────────────────────────────────────────────────

function TeamPicker({
  teams, selected, onSelect, label,
}: { teams: RawMLBTeam[]; selected: RawMLBTeam | null; onSelect: (t: RawMLBTeam) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) ||
                      t.abbreviation.toLowerCase().includes(search.toLowerCase())),
    [teams, search],
  );

  return (
    <div className="ta-team-picker">
      <button className={`ta-team-btn ${selected ? 'ta-team-btn--selected' : ''}`}
        onClick={() => setOpen(v => !v)}>
        {selected ? (
          <>
            <div className="ta-team-logo-wrap">
              <TeamLogo teamId={selected.id} size={22} />
            </div>
            <span className="ta-team-name">{selected.name}</span>
          </>
        ) : (
          <span className="ta-team-placeholder">{label}</span>
        )}
        <ChevronDown size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
      </button>

      {open && (
        <>
          <div className="ta-team-overlay" onClick={() => setOpen(false)} />
          <div className="ta-team-dropdown">
            <div className="ta-team-search-wrap">
              <Search size={13} />
              <input
                className="ta-team-search"
                placeholder="Search teams…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ta-team-list">
              {filtered.map(t => (
                <button key={t.id} className={`ta-team-option ${selected?.id === t.id ? 'ta-team-option--active' : ''}`}
                  onClick={() => { onSelect(t); setOpen(false); setSearch(''); }}>
                  <div className="ta-team-option-logo">
                    <TeamLogo teamId={t.id} size={20} />
                  </div>
                  <span>{t.name}</span>
                  <span className="ta-team-abbr">{t.abbreviation}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Player chip ──────────────────────────────────────────────────────

function PlayerChip({
  player, onRemove, onGradeChange,
}: { player: TradePlayer; onRemove: () => void; onGradeChange?: (grade: ProspectGrade) => void }) {
  return (
    <div className={`player-chip ${player.type === 'prospect' ? 'player-chip--prospect' : ''}`}>
      <div className="player-chip-headshot">
        <PlayerHeadshot mlbId={player.mlbId} size={32} alt={player.name} />
      </div>
      <div className="player-chip-info">
        <span className="player-chip-name">{player.name}</span>
        <span className="player-chip-meta">{player.pos} · {player.team}{player.age > 0 ? ` · ${player.age}y` : ''}</span>
      </div>
      {player.type === 'prospect' ? (
        <select
          className="prospect-grade-select"
          value={player.prospectGrade ?? 'top100'}
          onChange={e => onGradeChange?.(e.target.value as ProspectGrade)}
          title="Prospect Tier"
        >
          {(['top10','top25','top50','top100','other'] as ProspectGrade[]).map(g => (
            <option key={g} value={g}>{GRADE_LABEL[g]}</option>
          ))}
        </select>
      ) : (
        <div className="player-chip-war">
          <span className="pch-war-label">PROJ</span>
          <span className="pch-war-val">{player.projWar.toFixed(1)}</span>
        </div>
      )}
      <button className="player-chip-remove" onClick={onRemove}><X size={12} /></button>
    </div>
  );
}

// ─── Roster row ───────────────────────────────────────────────────────

function RosterRow({
  entry, projWar, isSelected, onToggle,
}: {
  entry:      RawMLBRosterPlayerHydrated;
  projWar:    number;
  isSelected: boolean;
  onToggle:   () => void;
}) {
  const age = entry.person.currentAge ?? 0;
  const pos = entry.position.abbreviation;

  return (
    <button className={`ta-roster-row ${isSelected ? 'ta-roster-row--on' : ''}`} onClick={onToggle}>
      <div className="ta-roster-headshot">
        <PlayerHeadshot mlbId={entry.person.id} size={28} alt={entry.person.fullName} />
      </div>
      <div className="ta-roster-info">
        <span className="ta-roster-name">{entry.person.fullName}</span>
        <span className="ta-roster-meta">{pos}{age > 0 ? ` · ${age}` : ''}</span>
      </div>
      <span className="ta-roster-war">{projWar > 0 ? `${projWar.toFixed(1)}▸` : '—'}</span>
      <div className={`ta-roster-toggle ${isSelected ? 'ta-roster-toggle--on' : ''}`}>
        {isSelected ? <Check size={11} /> : <Plus size={11} />}
      </div>
    </button>
  );
}

// ─── Prospect row (uses local PROSPECT_DATA, no API) ─────────────────

function ProspectRow({
  mlbId, entry, isSelected, onAdd,
}: {
  mlbId:      number;
  entry:      ProspectEntry;
  isSelected: boolean;
  onAdd:      () => void;
}) {
  const gradeColor = GRADE_COLOR[entry.tier];
  return (
    <button className={`ta-roster-row ${isSelected ? 'ta-roster-row--on' : ''}`} onClick={onAdd}>
      <div className="ta-roster-headshot">
        <PlayerHeadshot mlbId={mlbId} size={28} alt={entry.name} />
      </div>
      <div className="ta-roster-info">
        <span className="ta-roster-name">{entry.name}</span>
        <span className="ta-roster-meta">
          {entry.pos}{entry.age > 0 ? ` · ${entry.age}y` : ''}
        </span>
      </div>
      <span className="ta-roster-prospect-badge" style={{ color: gradeColor, borderColor: gradeColor }}>
        {GRADE_LABEL[entry.tier]}
      </span>
      <div className={`ta-roster-toggle ${isSelected ? 'ta-roster-toggle--on' : ''}`}>
        {isSelected ? <Check size={11} /> : <Plus size={11} />}
      </div>
    </button>
  );
}

// ─── Trade column ─────────────────────────────────────────────────────

interface TradeColumnProps {
  label:          string;
  team:           RawMLBTeam | null;
  allTeams:       RawMLBTeam[];
  players:        TradePlayer[];
  allTakenIds:    number[];
  batLeaderboard: FanGraphsBatterRow[];
  pitLeaderboard: FanGraphsPitcherRow[];
  batProj:        Map<number, number>;
  pitProj:        Map<number, number>;
  onTeamChange:   (t: RawMLBTeam) => void;
  onTeamSet:      (t: RawMLBTeam) => void; // sets team without clearing players
  onAdd:          (p: TradePlayer) => void;
  onRemove:       (id: number) => void;
  onGradeChange:  (id: number, grade: ProspectGrade) => void;
}

function TradeColumn({
  label, team, allTeams, players, allTakenIds,
  batLeaderboard, pitLeaderboard, batProj, pitProj,
  onTeamChange, onTeamSet, onAdd, onRemove, onGradeChange,
}: TradeColumnProps) {
  const [tab, setTab]                   = useState<'roster' | 'prospects'>('roster');
  const [prospectQuery, setProspectQuery] = useState('');
  const [globalQuery, setGlobalQuery]     = useState('');

  const { data: roster = [], isLoading: rosterLoading } = useTeamRoster(team?.id ?? null);
  const { data: globalResults  = [], isFetching: globalFetching  } = useProspectSearch(globalQuery);

  const selectedIds = new Set(players.map(p => p.mlbId));
  const takenSet    = new Set(allTakenIds);

  const batById = useMemo(() => new Map(batLeaderboard.map(r => [r.mlbId, r])), [batLeaderboard]);
  const pitById = useMemo(() => new Map(pitLeaderboard.map(r => [r.mlbId, r])), [pitLeaderboard]);

  const PITCHER_POS = new Set(['P', 'SP', 'RP', 'CP']);

  function isPitcherPos(pos: string) {
    return PITCHER_POS.has(pos.toUpperCase());
  }

  // Use position to pick the right leaderboard — prevents pitchers (who appear
  // in the batting leaderboard at 0 PA with qual=0) from getting a batting projection.
  // When pos is unknown, fall back to pitching if the player is in the pitching leaderboard.
  function getProj(id: number, pos?: string): number {
    if ((pos && isPitcherPos(pos)) || pitById.has(id)) return pitProj.get(id) ?? 0;
    return batProj.get(id) ?? pitProj.get(id) ?? 0;
  }

  function withAgeCurve(rawProj: number, age: number): number {
    return rawProj > 0 ? Math.max(0, rawProj + ageCurveDelta(age)) : 0;
  }

  function globalResultToPlayer(r: typeof globalResults[0]): TradePlayer {
    const id   = r.id;
    const pos  = r.primaryPosition?.abbreviation ?? '?';
    const bat  = batById.get(id);
    const pit  = pitById.get(id);
    const age  = r.currentAge ?? 0;
    const proj = withAgeCurve(getProj(id, pos), age);
    const base = {
      mlbId:   id,
      name:    r.fullName,
      team:    allTeams.find(t => t.id === r.currentTeam?.id)?.abbreviation ?? team?.abbreviation ?? '?',
      teamId:  r.currentTeam?.id ?? team?.id ?? 0,
      pos,
      age,
      projWar: proj,
    };
    if (isPitcherPos(pos) && pit) return { ...base, war: pit.war, ip: pit.ip, era: pit.era, fip: pit.fip, type: 'pit' };
    if (!isPitcherPos(pos) && bat) return { ...base, war: bat.war, pa: bat.pa, wrcPlus: bat.wrcPlus, woba: bat.woba, type: 'bat' };
    if (pit) return { ...base, war: pit.war, ip: pit.ip, era: pit.era, fip: pit.fip, type: 'pit' };
    if (bat) return { ...base, war: bat.war, pa: bat.pa, wrcPlus: bat.wrcPlus, woba: bat.woba, type: 'bat' };
    return { ...base, war: 0, projWar: 0, type: 'prospect', prospectGrade: gradeForPlayer(id, age) };
  }

  function rosterEntryToPlayer(entry: RawMLBRosterPlayerHydrated): TradePlayer {
    const id   = entry.person.id;
    const pos  = entry.position.abbreviation;
    const bat  = batById.get(id);
    const pit  = pitById.get(id);
    const age  = entry.person.currentAge ?? 0;
    const proj = withAgeCurve(getProj(id, pos), age);
    const base = {
      mlbId:   id,
      name:    entry.person.fullName,
      team:    team?.abbreviation ?? '—',
      teamId:  team?.id ?? 0,
      pos,
      age,
      projWar: proj,
    };
    if (isPitcherPos(pos) && pit) return { ...base, war: pit.war, ip: pit.ip, era: pit.era, fip: pit.fip, type: 'pit' };
    if (!isPitcherPos(pos) && bat) return { ...base, war: bat.war, pa: bat.pa, wrcPlus: bat.wrcPlus, woba: bat.woba, type: 'bat' };
    if (pit) return { ...base, war: pit.war, ip: pit.ip, era: pit.era, fip: pit.fip, type: 'pit' };
    if (bat) return { ...base, war: bat.war, pa: bat.pa, wrcPlus: bat.wrcPlus, woba: bat.woba, type: 'bat' };
    const grade = PROSPECT_TIERS[id];
    if (grade) return { ...base, war: 0, projWar: 0, type: 'prospect', prospectGrade: grade };
    return { ...base, war: 0, type: 'unknown' };
  }

  function prospectDataToPlayer(mlbId: number, entry: ProspectEntry): TradePlayer {
    return {
      mlbId,
      name:          entry.name,
      team:          team?.abbreviation ?? '—',
      teamId:        team?.id ?? entry.teamId,
      pos:           entry.pos,
      age:           entry.age,
      war:           0,
      projWar:       0,
      type:          'prospect',
      prospectGrade: entry.tier,
    };
  }

  const sortedRoster = useMemo(() =>
    [...roster]
      .filter(e => !takenSet.has(e.person.id) || selectedIds.has(e.person.id))
      .sort((a, b) => getProj(b.person.id) - getProj(a.person.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, batProj, pitProj, allTakenIds, players],
  );

  // Local prospect list — only players in PROSPECT_DATA for this team, sorted by rank
  const teamProspectList = useMemo(() => {
    if (!team) return [];
    const q = prospectQuery.trim().toLowerCase();
    return Object.entries(PROSPECT_DATA)
      .filter(([, e]) => e.teamId === team.id)
      .filter(([, e]) => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([id, e]) => ({ mlbId: Number(id), entry: e }));
  }, [team, prospectQuery]);

  return (
    <div className="trade-column">

      {/* Global player search — no team required */}
      <div className="ta-global-search">
        <div className="ta-global-search-wrap">
          <Search size={14} className="ta-global-search-icon" />
          <input
            className="ta-global-search-input"
            placeholder="Search any player…"
            value={globalQuery}
            onChange={e => setGlobalQuery(e.target.value)}
          />
          {globalQuery && (
            <button className="ta-global-search-clear" onClick={() => setGlobalQuery('')}>
              <X size={12} />
            </button>
          )}
        </div>
        {globalQuery.length >= 2 && (
          <div className="ta-global-results">
            {globalFetching && <div className="ta-roster-loading">Searching…</div>}
            {!globalFetching && globalResults.length === 0 && (
              <div className="ta-roster-empty">No players found</div>
            )}
            {!globalFetching && globalResults.slice(0, 8).map(r => {
              const isSelected = selectedIds.has(r.id);
              const proj = getProj(r.id);
              const isProspect = proj === 0 && !batById.has(r.id) && !pitById.has(r.id);
              return (
                <button
                  key={r.id}
                  className={`ta-roster-row ${isSelected ? 'ta-roster-row--on' : ''}`}
                  onClick={() => {
                    if (isSelected) { onRemove(r.id); }
                    else {
                      onAdd(globalResultToPlayer(r));
                      setGlobalQuery('');
                      if (!team && r.currentTeam) {
                        const matched = allTeams.find(t => t.id === r.currentTeam!.id);
                        if (matched) onTeamSet(matched);
                      }
                    }
                  }}
                >
                  <div className="ta-roster-headshot">
                    <PlayerHeadshot mlbId={r.id} size={28} alt={r.fullName} />
                  </div>
                  <div className="ta-roster-info">
                    <span className="ta-roster-name">{r.fullName}</span>
                    <span className="ta-roster-meta">
                      {r.primaryPosition?.abbreviation ?? '—'}
                      {r.currentTeam ? ` · ${r.currentTeam.abbreviation}` : ''}
                      {r.currentAge ? ` · ${r.currentAge}y` : ''}
                    </span>
                  </div>
                  {isProspect ? (
                    <span className="ta-roster-war" style={{ color: '#94a3b8', fontSize: '10px' }}>PROS</span>
                  ) : proj > 0 ? (
                    <span className="ta-roster-war">{proj.toFixed(1)}▸</span>
                  ) : null}
                  <div className={`ta-roster-toggle ${isSelected ? 'ta-roster-toggle--on' : ''}`}>
                    {isSelected ? <Check size={11} /> : <Plus size={11} />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <TeamPicker
        teams={allTeams}
        selected={team}
        onSelect={onTeamChange}
        label={`Browse ${label} roster (optional)`}
      />

      {players.length > 0 && (
        <div className="ta-trading-block">
          <div className="ta-trading-label">Trading away</div>
          <div className="ta-chips-list">
            {players.map(p => (
              <PlayerChip
                key={p.mlbId}
                player={p}
                onRemove={() => onRemove(p.mlbId)}
                onGradeChange={(grade) => onGradeChange(p.mlbId, grade)}
              />
            ))}
          </div>
        </div>
      )}

      {team && (
        <div className="ta-roster-panel">
          <div className="ta-roster-tabs">
            <button className={`ta-rtab ${tab === 'roster' ? 'ta-rtab--on' : ''}`}
              onClick={() => setTab('roster')}>
              40-Man Roster
            </button>
            <button className={`ta-rtab ${tab === 'prospects' ? 'ta-rtab--on' : ''}`}
              onClick={() => setTab('prospects')}>
              Prospects
            </button>
          </div>

          {tab === 'roster' && (
            <div className="ta-roster-list">
              {rosterLoading && <div className="ta-roster-loading">Loading roster…</div>}
              {!rosterLoading && roster.length === 0 && (
                <div className="ta-roster-empty">No roster data found</div>
              )}
              {sortedRoster.map(e => (
                <RosterRow
                  key={e.person.id}
                  entry={e}
                  projWar={getProj(e.person.id)}
                  isSelected={selectedIds.has(e.person.id)}
                  onToggle={() => {
                    if (selectedIds.has(e.person.id)) onRemove(e.person.id);
                    else onAdd(rosterEntryToPlayer(e));
                  }}
                />
              ))}
            </div>
          )}

          {tab === 'prospects' && (
            <div className="ta-prospects-panel">
              <div className="ta-prospect-search-wrap">
                <Search size={13} />
                <input
                  className="ta-prospect-search"
                  placeholder={`Search ${team.name} prospects…`}
                  value={prospectQuery}
                  onChange={e => setProspectQuery(e.target.value)}
                />
                {prospectQuery && (
                  <button className="ta-global-search-clear" onClick={() => setProspectQuery('')}>
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="ta-roster-list">
                {teamProspectList.length === 0 && (
                  <div className="ta-roster-empty">
                    {prospectQuery ? 'No prospects matching that name' : 'No prospect data for this team'}
                  </div>
                )}
                {teamProspectList.map(({ mlbId, entry }) => {
                  const isTaken = takenSet.has(mlbId) && !selectedIds.has(mlbId);
                  if (isTaken) return null;
                  return (
                    <ProspectRow
                      key={mlbId}
                      mlbId={mlbId}
                      entry={entry}
                      isSelected={selectedIds.has(mlbId)}
                      onAdd={() => {
                        if (selectedIds.has(mlbId)) onRemove(mlbId);
                        else onAdd(prospectDataToPlayer(mlbId, entry));
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!team && (
        <div className="ta-no-team">
          Select a team above to load their roster and prospects
        </div>
      )}
    </div>
  );
}

// ─── Breakdown card ───────────────────────────────────────────────────

function BreakdownCard({ players, label }: { players: TradePlayer[]; label: string }) {
  return (
    <Card title={`${label} Breakdown`}>
      {players.length === 0 ? (
        <div className="trade-empty">No players selected for {label}</div>
      ) : (
        players.map(p => (
          <div key={p.mlbId} className="trade-player-row">
            <div className="tpr-headshot">
              <PlayerHeadshot mlbId={p.mlbId} size={40} alt={p.name} />
            </div>
            <div className="tpr-info">
              <span className="tpr-name">{p.name}</span>
              <span className="tpr-meta">
                {p.pos} · {p.team}{p.age > 0 ? ` · Age ${p.age}` : ''}
                {p.type === 'prospect' && <span className="tpr-prospect-tag">PROSPECT</span>}
              </span>
            </div>
            <div className="tpr-stats">
              {(() => {
                const c = lookupContract(p.name);
                if (!c) return null;
                return (
                  <div className="tpr-contract">
                    <span className="tpr-contract-salary">{formatSalary(c.salary2026)}</span>
                    <span className="tpr-contract-detail">
                      {statusLabel(c.status)}
                      {c.contractYears > 1 ? ` · ${c.contractYears}yr` : ''}
                    </span>
                  </div>
                );
              })()}
              {p.type === 'prospect' ? <>
                <div className="tpr-stat">
                  <span>Tier</span>
                  <span style={{ color: GRADE_COLOR[p.prospectGrade ?? 'top100'] }}>{GRADE_LABEL[p.prospectGrade ?? 'top100']}</span>
                </div>
                <div className="tpr-stat">
                  <span>Peak</span>
                  <span>{PROSPECT_PEAK_WAR[p.prospectGrade ?? 'top100']}W</span>
                </div>
                <div className="tpr-stat">
                  <span>Hit%</span>
                  <span>{(PROSPECT_HIT_RATE[p.prospectGrade ?? 'top100'] * 100).toFixed(0)}%</span>
                </div>
                <div className="tpr-stat tpr-stat--value">
                  <span>Value</span>
                  <span>${tradeValue(p).toFixed(1)}M</span>
                </div>
              </> : <>
                <div className="tpr-stat">
                  <span>{YEAR} WAR</span>
                  <span>{p.war.toFixed(1)}</span>
                </div>
                <div className="tpr-stat tpr-stat--proj">
                  <span>Proj.</span>
                  <span>{p.projWar.toFixed(1)}W</span>
                </div>
                {p.type === 'bat' && <>
                  {p.wrcPlus != null && <div className="tpr-stat"><span>wRC+</span><span>{p.wrcPlus}</span></div>}
                  {p.pa      != null && <div className="tpr-stat"><span>PA</span><span>{p.pa}</span></div>}
                </>}
                {p.type === 'pit' && <>
                  {p.era != null && <div className="tpr-stat"><span>ERA</span><span>{p.era.toFixed(2)}</span></div>}
                  {p.fip != null && <div className="tpr-stat"><span>FIP</span><span>{p.fip.toFixed(2)}</span></div>}
                  {p.ip  != null && <div className="tpr-stat"><span>IP</span><span>{p.ip.toFixed(0)}</span></div>}
                </>}
                {p.type === 'unknown' && <div className="tpr-no-stats">No {YEAR} stats yet</div>}
                <div className="tpr-stat tpr-stat--value">
                  <span>Value</span>
                  <span>${tradeValue(p).toFixed(1)}M</span>
                </div>
              </>}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function TradeAnalyzerPage() {
  const [team1, setTeam1] = useState<RawMLBTeam | null>(null);
  const [team2, setTeam2] = useState<RawMLBTeam | null>(null);
  const [side1, setSide1] = useState<TradePlayer[]>([]);
  const [side2, setSide2] = useState<TradePlayer[]>([]);

  const { teams: allTeams } = useMLBRawTeams();

  // Current season leaderboards
  const { data: batCurr = [] } = useBattingLeaderboard();
  const { data: pitCurr = [] } = usePitchingLeaderboard();

  // Prior 3 seasons — cached for 7 days (past seasons don't change)
  const { data: batY1 = [] } = useBattingLeaderboardByYear(YEAR - 1);
  const { data: batY2 = [] } = useBattingLeaderboardByYear(YEAR - 2);
  const { data: batY3 = [] } = useBattingLeaderboardByYear(YEAR - 3);
  const { data: pitY1 = [] } = usePitchingLeaderboardByYear(YEAR - 1);
  const { data: pitY2 = [] } = usePitchingLeaderboardByYear(YEAR - 2);
  const { data: pitY3 = [] } = usePitchingLeaderboardByYear(YEAR - 3);

  // Build projection maps once all seasons load
  const { batProj, pitProj } = useMemo(
    () => buildProjectionMaps(
      [batCurr, batY1, batY2, batY3],
      [pitCurr, pitY1, pitY2, pitY3],
    ),
    [batCurr, batY1, batY2, batY3, pitCurr, pitY1, pitY2, pitY3],
  );

  const analysis  = useMemo(() => analyzeTrade(side1, side2), [side1, side2]);
  const allIds    = useMemo(() => [...side1, ...side2].map(p => p.mlbId), [side1, side2]);
  const bothSides = side1.length > 0 && side2.length > 0;

  const addTo1      = useCallback((p: TradePlayer) => setSide1(prev => [...prev, p]), []);
  const addTo2      = useCallback((p: TradePlayer) => setSide2(prev => [...prev, p]), []);
  const removeFrom1 = useCallback((id: number) => setSide1(prev => prev.filter(p => p.mlbId !== id)), []);
  const removeFrom2 = useCallback((id: number) => setSide2(prev => prev.filter(p => p.mlbId !== id)), []);
  const gradeChange1 = useCallback((id: number, grade: ProspectGrade) =>
    setSide1(prev => prev.map(p => p.mlbId === id ? { ...p, prospectGrade: grade } : p)), []);
  const gradeChange2 = useCallback((id: number, grade: ProspectGrade) =>
    setSide2(prev => prev.map(p => p.mlbId === id ? { ...p, prospectGrade: grade } : p)), []);

  const insights = useMemo(() => {
    if (!bothSides) return [];
    const out: string[] = [];
    const abs  = Math.abs(analysis.fairness);
    const gap  = Math.abs(analysis.s1Val - analysis.s2Val).toFixed(0);
    const nameA = team1?.name ?? 'Side A';
    const nameB = team2?.name ?? 'Side B';
    const loser = analysis.fairness > 0 ? nameA : nameB;

    if (abs <= 15)      out.push('✅ Roughly fair — both sides exchange comparable value.');
    else if (abs <= 40) out.push(`⚠️ Moderate imbalance — ${loser} gives up ~$${gap}M more in projected value.`);
    else                out.push(`🚨 Large imbalance — ${loser} gives up ~$${gap}M more in projected value. One side wins this decisively.`);

    if (Math.abs(analysis.warDelta) >= 1) {
      const warSender = analysis.warDelta > 0 ? nameA : nameB;
      out.push(`📈 Projected WAR gap of ${Math.abs(analysis.warDelta).toFixed(1)} W/season — ${warSender} sends more on-field production.`);
    }

    const young = [...side1, ...side2].filter(p => p.type !== 'prospect' && p.age > 0 && p.age <= 25);
    if (young.length) out.push(`🌟 ${young.map(p => p.name.split(' ').slice(-1)[0]).join(', ')} ${young.length === 1 ? 'is' : 'are'} 25 or younger — age premium already baked into value.`);

    const prospects = [...side1, ...side2].filter(p => p.type === 'prospect');
    if (prospects.length) {
      const elite = prospects.filter(p => p.prospectGrade === 'top10' || p.prospectGrade === 'top25');
      if (elite.length) out.push(`🔮 Elite prospect${elite.length > 1 ? 's' : ''} included — value based on peak WAR ceiling × hit-rate. Adjust tier to match current Pipeline rankings.`);
      else out.push(`🔮 ${prospects.length} prospect${prospects.length > 1 ? 's' : ''} included — value = peak WAR × hit-rate discount. Update tiers to match current org rankings.`);
    }

    return out;
  }, [side1, side2, analysis, bothSides, team1, team2]);

  return (
    <div className="trade-page">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Trade Analyzer</h1>
          <p className="page-subtitle">Team-based · 40-man roster + prospects · Marcel projected WAR · {YEAR}</p>
        </div>
        <Badge variant="purple">Flagship Tool</Badge>
      </div>

      {/* Two-column builder */}
      <div className="trade-builder">
        <TradeColumn
          label="Side A"
          team={team1}
          allTeams={allTeams}
          players={side1}
          allTakenIds={allIds}
          batLeaderboard={batCurr}
          pitLeaderboard={pitCurr}
          batProj={batProj}
          pitProj={pitProj}

          onTeamChange={t => { setTeam1(t); setSide1([]); }}
          onTeamSet={t => setTeam1(t)}
          onAdd={addTo1}
          onRemove={removeFrom1}
          onGradeChange={gradeChange1}
        />

        <div className="trade-divider">
          <div className="trade-divider-line" />
          <span className="trade-divider-label">VS</span>
          <div className="trade-divider-line" />
        </div>

        <TradeColumn
          label="Side B"
          team={team2}
          allTeams={allTeams}
          players={side2}
          allTakenIds={allIds}
          batLeaderboard={batCurr}
          pitLeaderboard={pitCurr}
          batProj={batProj}
          pitProj={pitProj}

          onTeamChange={t => { setTeam2(t); setSide2([]); }}
          onTeamSet={t => setTeam2(t)}
          onAdd={addTo2}
          onRemove={removeFrom2}
          onGradeChange={gradeChange2}
        />
      </div>

      {/* Fairness meter */}
      {bothSides && (
        <Card glow>
          <FairnessMeter
            score={analysis.fairness}
            labelA={team1?.abbreviation ?? 'Side A'}
            labelB={team2?.abbreviation ?? 'Side B'}
          />
          <div className="trade-summary-grid">
            <div className="trade-summary-item">
              <span className="tsi-label">Proj WAR Δ</span>
              <span className={`tsi-value ${analysis.warDelta > 0 ? 'tsi-pos' : analysis.warDelta < 0 ? 'tsi-neg' : ''}`}>
                {analysis.warDelta > 0 ? '+' : ''}{analysis.warDelta}
              </span>
            </div>
            <div className="trade-summary-item">
              <span className="tsi-label">Side A Value</span>
              <span className="tsi-value">${analysis.s1Val.toFixed(0)}M</span>
            </div>
            <div className="trade-summary-item">
              <span className="tsi-label">Side B Value</span>
              <span className="tsi-value">${analysis.s2Val.toFixed(0)}M</span>
            </div>
            <div className="trade-summary-item">
              <span className="tsi-label">Gap</span>
              <span className={`tsi-value ${analysis.s1Val > analysis.s2Val ? 'tsi-pos' : 'tsi-neg'}`}>
                {analysis.s1Val > analysis.s2Val ? '+' : ''}${(analysis.s1Val - analysis.s2Val).toFixed(0)}M
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Breakdown */}
      {(side1.length > 0 || side2.length > 0) && (
        <div className="trade-breakdown-row">
          <BreakdownCard players={side1} label="Side A" />
          <BreakdownCard players={side2} label="Side B" />
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card title="Trade Intelligence">
          <div className="trade-insights">
            {insights.map((ins, i) => (
              <div key={i} className="trade-insight-row">{ins}</div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}
