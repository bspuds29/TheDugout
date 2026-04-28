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
import '../../styles/shared.css';
import './TradeAnalyzerPage.css';

const YEAR = new Date().getFullYear();

// ─── Types ────────────────────────────────────────────────────────────

type ProspectGrade = 'A' | 'B' | 'C' | 'D';

interface TradePlayer {
  mlbId:          number;
  name:           string;
  team:           string;
  teamId:         number;
  pos:            string;
  age:            number;
  war:            number;      // current season raw WAR
  projWar:        number;      // multi-season projected WAR
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
  A: 'Elite (Top 50)',
  B: 'Top 100',
  C: 'Solid Prospect',
  D: 'Org Depth',
};

/**
 * Prospect expected value:
 *   peak WAR/yr  ×  hit-rate (probability of reaching that ceiling)
 *
 *   A: 4.0 WAR/yr × 60% =  2.40 effective WAR
 *   B: 2.5 WAR/yr × 45% =  1.13 effective WAR
 *   C: 1.5 WAR/yr × 30% =  0.45 effective WAR
 *   D: 1.0 WAR/yr × 15% =  0.15 effective WAR
 */
const PROSPECT_EFF_WAR:  Record<ProspectGrade, number> = { A: 2.40, B: 1.13, C: 0.45, D: 0.15 };
const PROSPECT_PEAK_WAR: Record<ProspectGrade, number> = { A: 4.0,  B: 2.5,  C: 1.5,  D: 1.0  };
const PROSPECT_HIT_RATE: Record<ProspectGrade, number> = { A: 0.60, B: 0.45, C: 0.30, D: 0.15 };

/**
 * Suggest a default prospect grade from age.
 * Pipeline rankings aren't available via public API, so this is just a
 * starting-point — users should bump up to A/B for elite prospects.
 *
 *   Age ≤ 21  → B  (young, high-ceiling)
 *   Age ≤ 23  → C  (solid prospect age)
 *   Age 24+   → D  (org depth / career minor leaguer)
 */
function gradeFromAge(age: number): ProspectGrade {
  if (age > 0 && age <= 21) return 'B';
  if (age <= 23)            return 'C';
  return 'D';
}

// ─── Marcel-style multi-season projection ────────────────────────────

const BATTER_FULL_PA   = 550;
const PITCHER_FULL_IP  = 170;
const LEAGUE_MEAN_WAR  = 1.5;   // average WAR for a roster player per full season
const REGRESSION_WT    = 2;     // weight of the mean anchor (equivalent to 2 "average" seasons)

// Weights: [current year, y-1, y-2, y-3] — more recent = heavier
const SEASON_WEIGHTS = [5, 4, 3, 2];

/**
 * Build per-player projected WAR maps for batters and pitchers.
 *
 * seasons[0] = current year (partial — pace-adjusted)
 * seasons[1..3] = prior full seasons (raw WAR used as-is)
 *
 * Formula (simplified Marcel):
 *   weighted_sum = Σ (warPerSeason_i × weight_i)
 *   projWAR = (weighted_sum + LEAGUE_MEAN_WAR × REGRESSION_WT)
 *             / (total_weight + REGRESSION_WT)
 *
 * This regresses hot starters toward their career average and gives
 * players with no prior history a sensible baseline.
 */
function buildProjectionMaps(
  batSeasons: FanGraphsBatterRow[][],
  pitSeasons: FanGraphsPitcherRow[][],
): { batProj: Map<number, number>; pitProj: Map<number, number> } {
  const batByYear = batSeasons.map(s => new Map(s.map(r => [r.mlbId, r])));
  const pitByYear = pitSeasons.map(s => new Map(s.map(r => [r.mlbId, r])));

  const allBatIds = new Set(batSeasons.flat().map(r => r.mlbId));
  const allPitIds = new Set(pitSeasons.flat().map(r => r.mlbId));

  function projectBatter(id: number): number {
    let wSum = 0, wTotal = 0;
    batByYear.forEach((map, i) => {
      const r = map.get(id);
      if (!r) return;
      // Pace current season; prior seasons are full-year already
      const warFs = i === 0 && r.pa != null && r.pa >= 30
        ? (r.war / r.pa) * BATTER_FULL_PA
        : r.war;
      wSum   += warFs * SEASON_WEIGHTS[i];
      wTotal += SEASON_WEIGHTS[i];
    });
    if (wTotal === 0) return 0;
    return Math.max(0, (wSum + LEAGUE_MEAN_WAR * REGRESSION_WT) / (wTotal + REGRESSION_WT));
  }

  function projectPitcher(id: number): number {
    let wSum = 0, wTotal = 0;
    pitByYear.forEach((map, i) => {
      const r = map.get(id);
      if (!r) return;
      const warFs = i === 0 && r.ip != null && r.ip >= 15
        ? (r.war / r.ip) * PITCHER_FULL_IP
        : r.war;
      wSum   += warFs * SEASON_WEIGHTS[i];
      wTotal += SEASON_WEIGHTS[i];
    });
    if (wTotal === 0) return 0;
    return Math.max(0, (wSum + LEAGUE_MEAN_WAR * REGRESSION_WT) / (wTotal + REGRESSION_WT));
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

/**
 * All values in $M at ≈$8M/WAR free-agent market rate.
 *
 * MLB:      projWAR × ageFactor × $8M
 * Prospect: effectiveWAR × ageFactor × $8M
 */
function tradeValue(p: TradePlayer): number {
  if (p.type === 'prospect') {
    const effWAR = PROSPECT_EFF_WAR[p.prospectGrade ?? 'B'];
    return effWAR * ageFactor(p.age > 0 ? p.age : 21) * 8;
  }
  return Math.max(0, p.projWar * ageFactor(p.age) * 8);
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

function FairnessMeter({ score }: { score: number }) {
  const abs    = Math.abs(score);
  const isLeft = score > 0;
  const pct    = Math.min(abs, 100);
  let verdict = 'FAIR TRADE', color = '#22c55e';
  if (abs > 25) { verdict = isLeft ? 'FAVORS SIDE A' : 'FAVORS SIDE B'; color = '#f59e0b'; }
  if (abs > 50) { verdict = isLeft ? 'HEAVILY FAVORS SIDE A' : 'HEAVILY FAVORS SIDE B'; color = '#ef4444'; }

  return (
    <div className="fairness-meter">
      <div className="fairness-title">Trade Fairness</div>
      <div className="fairness-track">
        <div className="fairness-label-left">Side A</div>
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
        <div className="fairness-label-right">Side B</div>
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
          value={player.prospectGrade ?? 'B'}
          onChange={e => onGradeChange?.(e.target.value as ProspectGrade)}
          title="Prospect Grade"
        >
          {(['A','B','C','D'] as ProspectGrade[]).map(g => (
            <option key={g} value={g}>Grade {g}</option>
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

// ─── Prospect search row ──────────────────────────────────────────────

function ProspectRow({
  result, isSelected, onAdd,
}: {
  result:     RawMLBSearchResult['people'][number];
  isSelected: boolean;
  onAdd:      () => void;
}) {
  const age   = result.currentAge ?? 0;
  const grade = gradeFromAge(age);
  const gradeColor = { A: '#a855f7', B: '#3b82f6', C: '#22c55e', D: '#94a3b8' }[grade];

  return (
    <button className={`ta-roster-row ${isSelected ? 'ta-roster-row--on' : ''}`} onClick={onAdd}>
      <div className="ta-roster-headshot">
        <PlayerHeadshot mlbId={result.id} size={28} alt={result.fullName} />
      </div>
      <div className="ta-roster-info">
        <span className="ta-roster-name">{result.fullName}</span>
        <span className="ta-roster-meta">
          {result.primaryPosition?.abbreviation ?? '—'}
          {result.currentTeam ? ` · ${result.currentTeam.abbreviation}` : ''}
          {age > 0 ? ` · ${age}y` : ''}
        </span>
      </div>
      <div className="ta-prospect-badges">
        {result.mlbDebutDate && (
          <span className="ta-prospect-national-badge" style={{ color: '#94a3b8', borderColor: 'rgba(148,163,184,0.3)' }}>
            MLB
          </span>
        )}
        <span className="ta-roster-prospect-badge" style={{ color: gradeColor, borderColor: gradeColor }}>
          {grade}
        </span>
      </div>
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
  onAdd:          (p: TradePlayer) => void;
  onRemove:       (id: number) => void;
  onGradeChange:  (id: number, grade: ProspectGrade) => void;
}

function TradeColumn({
  label, team, allTeams, players, allTakenIds,
  batLeaderboard, pitLeaderboard, batProj, pitProj,
  onTeamChange, onAdd, onRemove, onGradeChange,
}: TradeColumnProps) {
  const [tab, setTab]                   = useState<'roster' | 'prospects'>('roster');
  const [prospectQuery, setProspectQuery] = useState('');

  const { data: roster = [], isLoading: rosterLoading } = useTeamRoster(team?.id ?? null);
  const { data: prospectResults = [], isFetching: prospectFetching } = useProspectSearch(prospectQuery);

  const selectedIds = new Set(players.map(p => p.mlbId));
  const takenSet    = new Set(allTakenIds);

  const batById = useMemo(() => new Map(batLeaderboard.map(r => [r.mlbId, r])), [batLeaderboard]);
  const pitById = useMemo(() => new Map(pitLeaderboard.map(r => [r.mlbId, r])), [pitLeaderboard]);

  function getProj(id: number): number {
    return batProj.get(id) ?? pitProj.get(id) ?? 0;
  }

  function rosterEntryToPlayer(entry: RawMLBRosterPlayerHydrated): TradePlayer {
    const id   = entry.person.id;
    const bat  = batById.get(id);
    const pit  = pitById.get(id);
    const proj = getProj(id);
    const base = {
      mlbId:   id,
      name:    entry.person.fullName,
      team:    team?.abbreviation ?? '—',
      teamId:  team?.id ?? 0,
      pos:     entry.position.abbreviation,
      age:     entry.person.currentAge ?? 0,
      projWar: proj,
    };
    if (bat) return { ...base, war: bat.war, pa: bat.pa, wrcPlus: bat.wrcPlus, woba: bat.woba, type: 'bat' };
    if (pit) return { ...base, war: pit.war, ip: pit.ip, era: pit.era, fip: pit.fip, type: 'pit' };
    return { ...base, war: 0, type: 'unknown' };
  }

  function prospectResultToPlayer(r: typeof prospectResults[0]): TradePlayer {
    return {
      mlbId:         r.id,
      name:          r.fullName,
      team:          r.currentTeam?.abbreviation ?? team?.abbreviation ?? '—',
      teamId:        r.currentTeam?.id ?? team?.id ?? 0,
      pos:           r.primaryPosition?.abbreviation ?? '—',
      age:           r.currentAge ?? 0,
      war:           0,
      projWar:       0,
      type:          'prospect',
      // Auto-grade by age — user should adjust to match Pipeline rankings
      prospectGrade: gradeFromAge(r.currentAge ?? 0),
    };
  }

  const sortedRoster = useMemo(() =>
    [...roster]
      .filter(e => !takenSet.has(e.person.id) || selectedIds.has(e.person.id))
      .sort((a, b) => getProj(b.person.id) - getProj(a.person.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roster, batProj, pitProj, allTakenIds, players],
  );

  // Show all search results — do NOT filter by FanGraphs leaderboard.
  // Players like Konnor Griffin have MLB debuts but are still true prospects.
  const visibleProspects = prospectResults.filter(
    r => !takenSet.has(r.id) || selectedIds.has(r.id),
  );

  return (
    <div className="trade-column">
      <TeamPicker
        teams={allTeams}
        selected={team}
        onSelect={onTeamChange}
        label={`Pick ${label} Team`}
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
                  placeholder={`Search ${team.name} prospects by name…`}
                  value={prospectQuery}
                  onChange={e => setProspectQuery(e.target.value)}
                />
              </div>
              <div className="ta-prospect-grade-key">
                <span><strong style={{ color: '#a855f7' }}>A</strong> Elite / Top 50</span>
                <span><strong style={{ color: '#3b82f6' }}>B</strong> Top 100</span>
                <span><strong style={{ color: '#22c55e' }}>C</strong> Solid prospect</span>
                <span><strong style={{ color: '#94a3b8' }}>D</strong> Org depth</span>
              </div>
              <div className="ta-prospect-note">
                Grade auto-set by age — adjust to match Pipeline rankings
              </div>
              <div className="ta-roster-list">
                {prospectQuery.length < 2 && (
                  <div className="ta-roster-empty">
                    Type a name to find any player in their system
                  </div>
                )}
                {prospectFetching && <div className="ta-roster-loading">Searching…</div>}
                {!prospectFetching && prospectQuery.length >= 2 && visibleProspects.slice(0, 10).map(r => (
                  <ProspectRow
                    key={r.id}
                    result={r}
                    isSelected={selectedIds.has(r.id)}
                    onAdd={() => {
                      if (selectedIds.has(r.id)) onRemove(r.id);
                      else onAdd(prospectResultToPlayer(r));
                    }}
                  />
                ))}
                {!prospectFetching && prospectQuery.length >= 2 && visibleProspects.length === 0 && (
                  <div className="ta-roster-empty">No players found matching that name</div>
                )}
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
              {p.type === 'prospect' ? <>
                <div className="tpr-stat">
                  <span>Grade</span>
                  <span style={{ color: '#a855f7' }}>{p.prospectGrade}</span>
                </div>
                <div className="tpr-stat">
                  <span>Peak</span>
                  <span>{PROSPECT_PEAK_WAR[p.prospectGrade ?? 'B']}W</span>
                </div>
                <div className="tpr-stat">
                  <span>Hit%</span>
                  <span>{(PROSPECT_HIT_RATE[p.prospectGrade ?? 'B'] * 100).toFixed(0)}%</span>
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
    const abs = Math.abs(analysis.fairness);
    const gap = Math.abs(analysis.s1Val - analysis.s2Val).toFixed(0);

    if (abs <= 15)      out.push('✅ Roughly fair — both sides exchange comparable value.');
    else if (abs <= 40) out.push(`⚠️ Moderate imbalance — ${analysis.fairness > 0 ? 'Side A' : 'Side B'} gives up ~$${gap}M more in projected value.`);
    else                out.push(`🚨 Large imbalance — ${analysis.fairness > 0 ? 'Side A' : 'Side B'} gives up ~$${gap}M more in projected value. One side wins this decisively.`);

    if (Math.abs(analysis.warDelta) >= 1) {
      out.push(`📈 Projected WAR gap of ${Math.abs(analysis.warDelta).toFixed(1)} W/season — ${analysis.warDelta > 0 ? 'Side A' : 'Side B'} sends more on-field production.`);
    }

    const young = [...side1, ...side2].filter(p => p.type !== 'prospect' && p.age > 0 && p.age <= 25);
    if (young.length) out.push(`🌟 ${young.map(p => p.name.split(' ').slice(-1)[0]).join(', ')} ${young.length === 1 ? 'is' : 'are'} 25 or younger — age premium already baked into value.`);

    const prospects = [...side1, ...side2].filter(p => p.type === 'prospect');
    if (prospects.length) {
      const gradeA = prospects.filter(p => p.prospectGrade === 'A');
      if (gradeA.length) out.push(`🔮 Grade-A prospect${gradeA.length > 1 ? 's' : ''} valued at 4 WAR/yr ceiling × 60% hit rate — adjust grade if rankings differ.`);
      else out.push(`🔮 ${prospects.length} prospect${prospects.length > 1 ? 's' : ''} included — value = peak WAR × hit-rate discount. Update grades to match current org rankings.`);
    }

    return out;
  }, [side1, side2, analysis, bothSides]);

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
          onAdd={addTo2}
          onRemove={removeFrom2}
          onGradeChange={gradeChange2}
        />
      </div>

      {/* Fairness meter */}
      {bothSides && (
        <Card glow>
          <FairnessMeter score={analysis.fairness} />
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
