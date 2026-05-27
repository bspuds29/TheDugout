import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import SortableTable, { type SortMeta } from '../../components/ui/SortableTable';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import TeamLogo, { ABBR_TO_MLB_ID } from '../../components/ui/TeamLogo';
import {
  useBattingLeaderboard,
  usePitchingLeaderboard,
  useSavantExpectedBatterStats,
  useSavantExpectedPitcherStats,
  useSavantCustomBatterMap,
  useSavantCustomPitcherMap,
  type SavantExpectedStats,
} from '../../hooks/useMLBData';
import type { FanGraphsBatterRow, FanGraphsPitcherRow } from '../../data/api/fangraphs';
import FanGraphsBanner from '../../components/ui/FanGraphsBanner';
import '../../styles/shared.css';
import './LeaderboardPage.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Sentinel for "show qualified players only" — maps to the dynamically-computed threshold */
const QUALIFIED = -1;

const BAT_POS_GROUPS = [
  { label: 'All', values: [] },
  { label: 'C', values: ['C'] },
  { label: '1B', values: ['1B'] },
  { label: '2B', values: ['2B'] },
  { label: '3B', values: ['3B'] },
  { label: 'SS', values: ['SS'] },
  { label: 'OF', values: ['LF', 'CF', 'RF', 'OF'] },
  { label: 'DH', values: ['DH'] },
];

const PIT_ROLE_GROUPS = [
  { label: 'All', values: [] },
  { label: 'SP', values: ['SP'] },
  { label: 'RP', values: ['RP'] },
];

const AL_TEAMS = new Set([
  'LAA','HOU','ATH','OAK','SEA','TEX',
  'BAL','BOS','NYY','TB','TBR','TOR',
  'CWS','CHW','CLE','DET','KC','KCR','MIN',
]);
const NL_TEAMS = new Set([
  'ARI','COL','LAD','SD','SDP','SF','SFG',
  'CHC','CIN','MIL','PIT','STL',
  'ATL','MIA','NYM','PHI','WSH','WSN',
]);

function teamLeague(abbr: string): 'AL' | 'NL' | null {
  const a = abbr.toUpperCase();
  if (AL_TEAMS.has(a)) return 'AL';
  if (NL_TEAMS.has(a)) return 'NL';
  return null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const pct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : '—');
const avg3 = (v: number | null) => (v != null ? v.toFixed(3) : '—');
const dec2 = (v: number | null) => (v != null ? v.toFixed(2) : '—');
const dec1 = (v: number | null) => (v != null ? v.toFixed(1) : '—');
const int = (v: number | null) => (v != null ? Math.round(v).toString() : '—');
const mph = (v: number | null) => (v != null ? v.toFixed(1) : '—');

// ─── Merged row types ─────────────────────────────────────────────────────────

type MergedBatterRow = FanGraphsBatterRow & {
  sc_ev: number | null;
  sc_la: number | null;
  sc_sweet: number | null;
  sc_pull: number | null;
  sc_straight: number | null;
  sc_oppo: number | null;
  sc_whiff: number | null;
  sc_chase: number | null;
  sc_sprint: number | null;
  xs_xba: number | null;
  xs_xslg: number | null;
  xs_woba: number | null;
  xs_xwoba: number | null;
  xs_xobp: number | null;
  xs_xiso: number | null;
  xs_wobacon: number | null;
  xs_xwobacon: number | null;
  xs_bacon: number | null;
  xs_xbacon: number | null;
  xs_baxba: number | null;
};

type MergedPitcherRow = FanGraphsPitcherRow & {
  sc_ev: number | null;
  sc_la: number | null;
  sc_whiff: number | null;
  sc_chase: number | null;
  sc_fbVelo: number | null;
  sc_fbSpin: number | null;
  sc_barrel: number | null;
  sc_hard: number | null;
  xs_xba: number | null;
  xs_xslg: number | null;
  xs_woba: number | null;
  xs_xwoba: number | null;
  xs_xobp: number | null;
  xs_xiso: number | null;
  xs_wobacon: number | null;
  xs_xwobacon: number | null;
  xs_bacon: number | null;
  xs_xbacon: number | null;
  xs_baxba: number | null;
  xs_slgxslg: number | null;
  xs_wobaxwoba: number | null;
};

// ─── Helper functions ─────────────────────────────────────────────────────────

function scVal(
  map: Map<number, Record<string, string>> | undefined,
  mlbId: number,
  col: string
): number | null {
  if (!map) return null;
  const row = map.get(mlbId);
  if (!row) return null;
  const raw = row[col];
  if (raw == null || raw === '' || raw === 'null') return null;
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function xsVal(
  xStats: Map<number, SavantExpectedStats> | undefined,
  mlbId: number,
  field: keyof SavantExpectedStats
): number | null {
  if (!xStats) return null;
  const row = xStats.get(mlbId);
  if (!row) return null;
  const v = row[field];
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return isNaN(n) ? null : n;
}

function mergeBatterRows(
  rows: FanGraphsBatterRow[],
  xStats: Map<number, SavantExpectedStats> | undefined,
  scMap: Map<number, Record<string, string>> | undefined
): MergedBatterRow[] {
  return rows.map((r) => ({
    ...r,
    sc_ev: scVal(scMap, r.mlbId, 'exit_velocity_avg'),
    sc_la: scVal(scMap, r.mlbId, 'launch_angle_avg'),
    sc_sweet: scVal(scMap, r.mlbId, 'sweet_spot_percent'),
    sc_pull: scVal(scMap, r.mlbId, 'pull_percent'),
    sc_straight: scVal(scMap, r.mlbId, 'straightaway_percent'),
    sc_oppo: scVal(scMap, r.mlbId, 'opposite_percent'),
    sc_whiff: scVal(scMap, r.mlbId, 'whiff_percent'),
    sc_chase: scVal(scMap, r.mlbId, 'o_swing_percent') ?? scVal(scMap, r.mlbId, 'chase_percent'),
    sc_sprint: scVal(scMap, r.mlbId, 'sprint_speed'),
    xs_xba: xsVal(xStats, r.mlbId, 'xba'),
    xs_xslg: xsVal(xStats, r.mlbId, 'xslg'),
    xs_woba: xsVal(xStats, r.mlbId, 'woba'),
    xs_xwoba: xsVal(xStats, r.mlbId, 'xwoba'),
    xs_xobp: xsVal(xStats, r.mlbId, 'xobp'),
    xs_xiso: xsVal(xStats, r.mlbId, 'xiso'),
    xs_wobacon: xsVal(xStats, r.mlbId, 'wobacon'),
    xs_xwobacon: xsVal(xStats, r.mlbId, 'xwobacon'),
    xs_bacon: xsVal(xStats, r.mlbId, 'bacon'),
    xs_xbacon: xsVal(xStats, r.mlbId, 'xbacon'),
    xs_baxba: xsVal(xStats, r.mlbId, 'baxba'),
  }));
}

function mergePitcherRows(
  rows: FanGraphsPitcherRow[],
  xStats: Map<number, SavantExpectedStats> | undefined,
  scMap: Map<number, Record<string, string>> | undefined
): MergedPitcherRow[] {
  return rows.map((r) => ({
    ...r,
    sc_ev: scVal(scMap, r.mlbId, 'exit_velocity_avg'),
    sc_la: scVal(scMap, r.mlbId, 'launch_angle_avg'),
    sc_whiff: scVal(scMap, r.mlbId, 'whiff_percent'),
    sc_chase: scVal(scMap, r.mlbId, 'chase_percent'),
    sc_fbVelo: scVal(scMap, r.mlbId, 'fastball_avg_speed'),
    sc_fbSpin: scVal(scMap, r.mlbId, 'fastball_avg_spin'),
    sc_barrel: scVal(scMap, r.mlbId, 'barrel_batted_rate'),
    sc_hard: scVal(scMap, r.mlbId, 'hard_hit_percent'),
    xs_xba: xsVal(xStats, r.mlbId, 'xba'),
    xs_xslg: xsVal(xStats, r.mlbId, 'xslg'),
    xs_woba: xsVal(xStats, r.mlbId, 'woba'),
    xs_xwoba: xsVal(xStats, r.mlbId, 'xwoba'),
    xs_xobp: xsVal(xStats, r.mlbId, 'xobp'),
    xs_xiso: xsVal(xStats, r.mlbId, 'xiso'),
    xs_wobacon: xsVal(xStats, r.mlbId, 'wobacon'),
    xs_xwobacon: xsVal(xStats, r.mlbId, 'xwobacon'),
    xs_bacon: xsVal(xStats, r.mlbId, 'bacon'),
    xs_xbacon: xsVal(xStats, r.mlbId, 'xbacon'),
    xs_baxba: xsVal(xStats, r.mlbId, 'baxba'),
    xs_slgxslg: xsVal(xStats, r.mlbId, 'slgxslg'),
    xs_wobaxwoba: xsVal(xStats, r.mlbId, 'wobaxwoba'),
  }));
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function colorPlus(v: number, neutral = 100): string {
  if (v >= 120) return 'var(--color-teal)';
  if (v >= 105) return 'var(--color-green)';
  if (v <= 80) return 'var(--color-red)';
  if (v <= 95) return 'var(--color-amber)';
  return 'var(--color-text-secondary)';
}

function diffColor(v: number | null, posIsGood: boolean): string {
  if (v == null) return 'var(--color-text-tertiary)';
  if (v > 0) return posIsGood ? 'var(--color-green)' : 'var(--color-red)';
  if (v < 0) return posIsGood ? 'var(--color-red)' : 'var(--color-green)';
  return 'var(--color-text-secondary)';
}

// ─── Render helpers ───────────────────────────────────────────────────────────

function monoSpan(v: number | null, format: (n: number) => string): React.ReactNode {
  if (v == null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
  return <span className="mono">{format(v)}</span>;
}

function coloredSpan(
  v: number | null,
  format: (n: number) => string,
  color: string
): React.ReactNode {
  if (v == null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
  return (
    <span className="mono" style={{ color }}>
      {format(v)}
    </span>
  );
}

// ─── RankCell ─────────────────────────────────────────────────────────────────

function RankCell({ rank }: { rank: number }) {
  return (
    <span
      className="mono"
      style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}
    >
      {rank}
    </span>
  );
}

// ─── NameCell ─────────────────────────────────────────────────────────────────

function NameCell({
  mlbId,
  name,
  team,
  onClick,
}: {
  mlbId: number;
  name: string;
  team: string;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        minWidth: 0,
      }}
      onClick={onClick}
    >
      <PlayerAvatar mlbId={mlbId} name={name} size={28} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <TeamLogo abbr={team} size={12} />
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{team}</span>
        </div>
      </div>
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  groups: { label: string; values: string[] }[];
  active: string;
  onSelect: (label: string) => void;
  teamFilter: string;
  onTeamChange: (team: string) => void;
  minPA: number;
  onMinPAChange: (v: number) => void;
  /** Computed qualified threshold — used only for the dropdown label */
  qualifiedThreshold?: number;
  qualifiedLabel?: string;
  label?: string;
  teams?: string[];
  paOptionsList: number[];
  leagueFilter: 'All' | 'AL' | 'NL';
  onLeagueChange: (v: 'All' | 'AL' | 'NL') => void;
}

function FilterBar({
  groups,
  active,
  onSelect,
  teamFilter,
  onTeamChange,
  minPA,
  onMinPAChange,
  qualifiedThreshold,
  qualifiedLabel,
  label = 'Min PA',
  teams = [],
  paOptionsList,
  leagueFilter,
  onLeagueChange,
}: FilterBarProps) {
  const isIP = label.includes('IP');
  const unit = isIP ? 'IP' : 'PA';
  const resolvedQualifiedLabel =
    qualifiedLabel ??
    (qualifiedThreshold != null ? `Qualified (${qualifiedThreshold}+ ${unit})` : 'Qualified');

  return (
    <div className="lb-filter-bar" style={{ flexDirection: 'column', gap: 8 }}>
      <div
        className="lb-filter-row"
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}
      >
        <div className="lb-tabs">
          {groups.map((g) => (
            <button
              key={g.label}
              className={`lb-tab${active === g.label ? ' lb-tab--active' : ''}`}
              onClick={() => onSelect(g.label)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="lb-tabs" style={{ marginLeft: 8 }}>
          {(['All', 'AL', 'NL'] as const).map((lg) => (
            <button
              key={lg}
              className={`lb-tab${leagueFilter === lg ? ' lb-tab--active' : ''}`}
              onClick={() => onLeagueChange(lg)}
            >
              {lg}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 'auto',
            flexWrap: 'wrap',
          }}
        >
          {teams.length > 0 && (
            <select
              className="lb-select"
              value={teamFilter}
              onChange={(e) => onTeamChange(e.target.value)}
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <select
            className="lb-select"
            value={minPA}
            onChange={(e) => onMinPAChange(Number(e.target.value))}
          >
            {/* Qualified sentinel option — always first so it's the natural default */}
            <option value={QUALIFIED}>{resolvedQualifiedLabel}</option>
            {paOptionsList.map((v) => (
              <option key={v} value={v}>
                {v === 0 ? `All ${unit}` : `${v}+ ${unit}`}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── BattingLeaderboardWithFilters ────────────────────────────────────────────

function BattingLeaderboardWithFilters() {
  const navigate = useNavigate();
  const { data: rawRows = [], isLoading: loadingFG } = useBattingLeaderboard();
  const { data: xStatsArr = [], isLoading: loadingXS } = useSavantExpectedBatterStats();
  const { data: scMapRaw, isLoading: loadingSC } = useSavantCustomBatterMap();

  // Filter state — QUALIFIED sentinel means "≥ 3.1 × team games played"
  const [posGroup, setPosGroup] = useState('All');
  const [teamFilter, setTeamFilter] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<'All' | 'AL' | 'NL'>('All');
  const [minPA, setMinPA] = useState(QUALIFIED);

  // Dynamic qualified threshold: 3.1 PA per team game played
  const qualifiedPA = useMemo(() => {
    if (rawRows.length === 0) return null;
    const maxG = Math.max(...rawRows.map((r) => r.g ?? 0));
    return maxG > 0 ? Math.round(3.1 * maxG) : null;
  }, [rawRows]);

  const allTeams = useMemo(() => Object.keys(ABBR_TO_MLB_ID).sort(), []);

  const xStatsMap = useMemo(() => {
    const m = new Map<number, SavantExpectedStats>();
    xStatsArr.forEach((r) => m.set(r.mlbId, r));
    return m;
  }, [xStatsArr]);

  const isLoading = loadingFG || loadingXS || loadingSC;

  const posGroupObj = BAT_POS_GROUPS.find((g) => g.label === posGroup);

  // Resolve sentinel to actual threshold
  const effectiveMinPA = minPA === QUALIFIED ? (qualifiedPA ?? 0) : minPA;

  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      if (effectiveMinPA > 0 && r.pa < effectiveMinPA) return false;
      if (teamFilter && r.team !== teamFilter) return false;
      if (leagueFilter !== 'All' && teamLeague(r.team) !== leagueFilter) return false;
      if (posGroupObj && posGroupObj.values.length > 0) {
        const pos = r.pos ?? '';
        const matches = posGroupObj.values.some((pv) => pos === pv || pos.includes(pv));
        if (!matches) return false;
      }
      return true;
    });
  }, [rawRows, effectiveMinPA, teamFilter, leagueFilter, posGroupObj]);

  const mergedRows = useMemo(
    () => mergeBatterRows(filteredRows, xStatsMap, scMapRaw),
    [filteredRows, xStatsMap, scMapRaw]
  );

  // Leader cards
  const leaderCards = useMemo(() => {
    if (mergedRows.length === 0) return null;
    const byWar    = [...mergedRows].sort((a, b) => (b.war    ?? 0)  - (a.war    ?? 0));
    const byHr     = [...mergedRows].sort((a, b) => (b.hr     ?? 0)  - (a.hr     ?? 0));
    const byWrcPlus = [...mergedRows].sort((a, b) => (b.wrcPlus ?? 0) - (a.wrcPlus ?? 0));
    const byXwoba  = [...mergedRows].sort((a, b) => (b.xs_xwoba ?? 0) - (a.xs_xwoba ?? 0));
    return { byWar, byHr, byWrcPlus, byXwoba };
  }, [mergedRows]);

  // Columns — single unified set
  const columns = useMemo(() => [
    {
      key: '__rank__',
      label: '#',
      tooltip: 'Current rank based on the sorted column',
      sortable: false,
      align: 'right' as const,
      width: '36px',
      render: (_v: unknown, _row: MergedBatterRow, rowIndex: number, meta: SortMeta) => (
        <RankCell rank={meta.reversed ? meta.total - rowIndex : rowIndex + 1} />
      ),
    },
    {
      key: 'name',
      label: 'Player',
      tooltip: 'Click any row to open the full player profile',
      sortable: true,
      align: 'left' as const,
      width: '160px',
      render: (_v: unknown, row: MergedBatterRow) => (
        <NameCell
          mlbId={row.mlbId}
          name={row.name}
          team={row.team}
          onClick={() => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name)}`)}
        />
      ),
    },
    {
      key: 'pos',
      label: 'Pos',
      tooltip: 'Primary fielding position',
      sortable: true,
      align: 'center' as const,
      width: '50px',
      render: (_v: unknown, row: MergedBatterRow) => (
        <span className="lb-pos-badge">{row.pos}</span>
      ),
    },
    {
      key: 'pa',
      label: 'PA',
      tooltip: 'Plate appearances — every trip to the plate including walks and HBP',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '52px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.pa, int),
    },
    {
      key: 'war',
      label: 'fWAR',
      tooltip: 'FanGraphs Wins Above Replacement. 2+ = solid starter, 5+ = All-Star, 8+ = MVP caliber',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.war, dec1),
    },
    {
      key: 'hr',
      label: 'HR',
      tooltip: 'Home runs',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '48px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.hr, int),
    },
    {
      key: 'avg',
      label: 'AVG',
      tooltip: 'Batting average (H ÷ AB). League avg ≈ .250',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.avg, avg3),
    },
    {
      key: 'obp',
      label: 'OBP',
      tooltip: 'On-base percentage — fraction of PAs resulting in a reach. League avg ≈ .320',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.obp, avg3),
    },
    {
      key: 'slg',
      label: 'SLG',
      tooltip: 'Slugging percentage — total bases per AB. League avg ≈ .415',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.slg, avg3),
    },
    {
      key: 'wrcPlus',
      label: 'wRC+',
      tooltip: 'Park-adjusted offensive value. 100 = league avg, 130 = 30% above avg',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) =>
        row.wrcPlus != null
          ? coloredSpan(row.wrcPlus, int, colorPlus(row.wrcPlus))
          : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>,
    },
    {
      key: 'xs_xwoba',
      label: 'xwOBA',
      tooltip: 'Expected wOBA — best Statcast contact metric. Strips out batted-ball luck and defense',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '66px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.xs_xwoba, avg3),
    },
    {
      key: 'xs_xba',
      label: 'xBA',
      tooltip: 'Expected Batting Average — Statcast model based on exit velocity + launch angle',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.xs_xba, avg3),
    },
    {
      key: 'kPct',
      label: 'K%',
      tooltip: 'Strikeout rate per PA. Lower is better for hitters. League avg ≈ 22%',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '54px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.kPct, pct),
    },
    {
      key: 'bbPct',
      label: 'BB%',
      tooltip: 'Walk rate per PA. ≥12% = highly selective',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '54px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.bbPct, pct),
    },
    {
      key: 'sc_ev',
      label: 'EV',
      tooltip: 'Average Exit Velocity in mph. ≥90 = consistent hard contact',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '56px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.sc_ev, mph),
    },
    {
      key: 'barrelPct',
      label: 'Barrel%',
      tooltip: 'Barrel rate — exit velo ≥98 mph at optimal launch angle. ≥10% = elite',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '68px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.barrelPct, pct),
    },
    {
      key: 'hardPct',
      label: 'Hard%',
      tooltip: 'Hard-hit rate — % of batted balls with exit velocity ≥95 mph',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.hardPct, pct),
    },
    {
      key: 'sc_whiff',
      label: 'Whiff%',
      tooltip: 'Swing-and-miss rate — swings that miss ÷ total swings. Lower = better contact',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '62px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.sc_whiff, pct),
    },
    {
      key: 'sc_chase',
      label: 'Chase%',
      tooltip: 'Chase rate — % of swings at pitches outside the strike zone. Lower is better',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '62px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.sc_chase, pct),
    },
    {
      key: 'sc_sprint',
      label: 'Sprint',
      tooltip: 'Sprint Speed in ft/sec. League avg ≈ 27 ft/s. ≥29 = elite speed',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '60px',
      render: (_v: unknown, row: MergedBatterRow) => monoSpan(row.sc_sprint, dec1),
    },
  ], [navigate]);

  if (isLoading) {
    return (
      <Card>
        <div
          className="live-loading-bar"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px' }}
        >
          <div className="live-loading-dot" />
          <span className="live-prompt">Loading batting stats…</span>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar
        groups={BAT_POS_GROUPS}
        active={posGroup}
        onSelect={setPosGroup}
        teamFilter={teamFilter}
        onTeamChange={setTeamFilter}
        leagueFilter={leagueFilter}
        onLeagueChange={setLeagueFilter}
        minPA={minPA}
        onMinPAChange={setMinPA}
        qualifiedThreshold={qualifiedPA ?? undefined}
        label="Min PA"
        teams={allTeams}
        paOptionsList={[0, 50, 100, 150, 200, 250, 300, 350, 400]}
      />

      {leaderCards && (
        <div className="stat-grid-4">
          <StatCard
            label="fWAR Leader"
            value={leaderCards.byWar[0] ? dec1(leaderCards.byWar[0].war) : '—'}
            sub={leaderCards.byWar[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byWar[0]?.mlbId} size={32} />}
          />
          <StatCard
            label="HR Leader"
            value={leaderCards.byHr[0] ? int(leaderCards.byHr[0].hr) : '—'}
            sub={leaderCards.byHr[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byHr[0]?.mlbId} size={32} />}
          />
          <StatCard
            label="wRC+ Leader"
            value={leaderCards.byWrcPlus[0] ? int(leaderCards.byWrcPlus[0].wrcPlus) : '—'}
            sub={leaderCards.byWrcPlus[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byWrcPlus[0]?.mlbId} size={32} />}
          />
          <StatCard
            label="xwOBA Leader"
            value={leaderCards.byXwoba[0] ? avg3(leaderCards.byXwoba[0].xs_xwoba) : '—'}
            sub={leaderCards.byXwoba[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byXwoba[0]?.mlbId} size={32} />}
          />
        </div>
      )}

      <Card>
        <SortableTable
          data={mergedRows as any}
          columns={columns as any}
          rowKey="mlbId"
          defaultSort="war"
          defaultDir="desc"
          onRowClick={(row: any) => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name as string)}`)}
        />
      </Card>
    </div>
  );
}

// ─── PitchingLeaderboardWithFilters ───────────────────────────────────────────

function PitchingLeaderboardWithFilters() {
  const navigate = useNavigate();
  const { data: rawRows = [], isLoading: loadingFG } = usePitchingLeaderboard();
  const { data: xStatsArr = [], isLoading: loadingXS } = useSavantExpectedPitcherStats();
  const { data: scMapRaw, isLoading: loadingSC } = useSavantCustomPitcherMap();

  // Filter state — QUALIFIED sentinel means "≥ 1.0 IP per team game played"
  const [roleGroup, setRoleGroup] = useState('All');
  const [teamFilter, setTeamFilter] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<'All' | 'AL' | 'NL'>('All');
  const [minIP, setMinIP] = useState(QUALIFIED);

  // Dynamic qualified threshold: 1.0 IP per team game played
  const qualifiedIP = useMemo(() => {
    if (rawRows.length === 0) return null;
    const maxG = Math.max(...rawRows.map((r) => r.g ?? 0));
    return maxG > 0 ? maxG : null;
  }, [rawRows]);

  const allTeams = useMemo(() => Object.keys(ABBR_TO_MLB_ID).sort(), []);

  const xStatsMap = useMemo(() => {
    const m = new Map<number, SavantExpectedStats>();
    xStatsArr.forEach((r) => m.set(r.mlbId, r));
    return m;
  }, [xStatsArr]);

  const isLoading = loadingFG || loadingXS || loadingSC;

  const roleGroupObj = PIT_ROLE_GROUPS.find((g) => g.label === roleGroup);

  // Resolve sentinel to actual threshold
  const effectiveMinIP = minIP === QUALIFIED ? (qualifiedIP ?? 0) : minIP;

  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      if (effectiveMinIP > 0 && (r.ip ?? 0) < effectiveMinIP) return false;
      if (teamFilter && r.team !== teamFilter) return false;
      if (leagueFilter !== 'All' && teamLeague(r.team) !== leagueFilter) return false;
      if (roleGroupObj && roleGroupObj.values.length > 0) {
        if (!roleGroupObj.values.includes(r.pos ?? '')) return false;
      }
      return true;
    });
  }, [rawRows, effectiveMinIP, teamFilter, leagueFilter, roleGroupObj]);

  const mergedRows = useMemo(
    () => mergePitcherRows(filteredRows, xStatsMap, scMapRaw),
    [filteredRows, xStatsMap, scMapRaw]
  );

  // Leader cards
  const leaderCards = useMemo(() => {
    if (mergedRows.length === 0) return null;
    const byWar = [...mergedRows].sort((a, b) => (b.war  ?? 0)  - (a.war  ?? 0));
    const byEra = [...mergedRows].sort((a, b) => (a.era  ?? 99) - (b.era  ?? 99));
    const byK   = [...mergedRows].sort((a, b) => (b.kPct ?? 0)  - (a.kPct ?? 0));
    const byFip = [...mergedRows].sort((a, b) => (a.fip  ?? 99) - (b.fip  ?? 99));
    return { byWar, byEra, byK, byFip };
  }, [mergedRows]);

  // Columns — single unified set
  const columns = useMemo(() => [
    {
      key: '__rank__',
      label: '#',
      tooltip: 'Current rank based on the sorted column',
      sortable: false,
      align: 'right' as const,
      width: '36px',
      render: (_v: unknown, _row: MergedPitcherRow, rowIndex: number, meta: SortMeta) => (
        <RankCell rank={meta.reversed ? meta.total - rowIndex : rowIndex + 1} />
      ),
    },
    {
      key: 'name',
      label: 'Player',
      tooltip: 'Click any row to open the full player profile',
      sortable: true,
      align: 'left' as const,
      width: '160px',
      render: (_v: unknown, row: MergedPitcherRow) => (
        <NameCell
          mlbId={row.mlbId}
          name={row.name}
          team={row.team}
          onClick={() => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name)}`)}
        />
      ),
    },
    {
      key: 'pos',
      label: 'Role',
      tooltip: 'Pitching role: SP (starter) or RP (reliever)',
      sortable: true,
      align: 'center' as const,
      width: '52px',
      render: (_v: unknown, row: MergedPitcherRow) => (
        <span className="lb-pos-badge lb-pos-badge--pit">{row.pos}</span>
      ),
    },
    {
      key: 'ip',
      label: 'IP',
      tooltip: 'Innings pitched',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '52px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.ip, dec1),
    },
    {
      key: 'war',
      label: 'fWAR',
      tooltip: 'FanGraphs WAR for pitchers. 2+ = solid starter, 4+ = ace-level',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.war, dec1),
    },
    {
      key: 'era',
      label: 'ERA',
      tooltip: 'Earned Run Average. ≤3.00 = excellent, ≥5.00 = struggling',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '56px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.era, dec2),
    },
    {
      key: 'fip',
      label: 'FIP',
      tooltip: 'Fielding Independent Pitching — K, BB, HBP, HR only. Better ERA predictor',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '56px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.fip, dec2),
    },
    {
      key: 'xera',
      label: 'xERA',
      tooltip: 'Expected ERA from Statcast contact quality. ≤3.00 = elite',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.xera, dec2),
    },
    {
      key: 'whip',
      label: 'WHIP',
      tooltip: 'Walks + Hits per Inning. ≤1.00 = elite command',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '58px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.whip, dec2),
    },
    {
      key: 'kPct',
      label: 'K%',
      tooltip: 'Strikeout rate per batter faced. ≥28% = elite swing-and-miss stuff',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '54px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.kPct, pct),
    },
    {
      key: 'bbPct',
      label: 'BB%',
      tooltip: 'Walk rate per batter faced. ≤6% = elite command',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '54px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.bbPct, pct),
    },
    {
      key: 'kBBPct',
      label: 'K-BB%',
      tooltip: 'Net strikeout rate (K% minus BB%). ≥20% = elite',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '62px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.kBBPct, pct),
    },
    {
      key: 'swStrPct',
      label: 'SwStr%',
      tooltip: 'Swinging strike rate per pitch. ≥13% = elite',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '62px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.swStrPct, pct),
    },
    {
      key: 'oSwingPct',
      label: 'Chase%',
      tooltip: 'Chase rate generated — % of out-of-zone pitches batters swing at. ≥32% = elite',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '62px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.oSwingPct, pct),
    },
    {
      key: 'gbPct',
      label: 'GB%',
      tooltip: 'Ground ball rate. Higher GB% = fewer HRs allowed',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '54px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.gbPct, pct),
    },
    {
      key: 'sc_ev',
      label: 'EV',
      tooltip: 'Avg exit velocity allowed (mph). Lower = better. ≤87 = excellent',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '56px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.sc_ev, mph),
    },
    {
      key: 'sc_barrel',
      label: 'Barrel%',
      tooltip: 'Barrel rate allowed — % of contact that was barreled. Lower = better',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '68px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.sc_barrel, pct),
    },
    {
      key: 'sc_fbVelo',
      label: 'FB Velo',
      tooltip: 'Average fastball velocity in mph. ≥95 = plus velocity',
      sortable: true,
      firstClickDir: 'desc' as const,
      align: 'right' as const,
      width: '64px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.sc_fbVelo, mph),
    },
    {
      key: 'xs_xwoba',
      label: 'xwOBA',
      tooltip: 'Expected wOBA allowed — best Statcast contact quality metric. Lower = better',
      sortable: true,
      firstClickDir: 'asc' as const,
      align: 'right' as const,
      width: '66px',
      render: (_v: unknown, row: MergedPitcherRow) => monoSpan(row.xs_xwoba, avg3),
    },
  ], [navigate]);

  if (isLoading) {
    return (
      <Card>
        <div
          className="live-loading-bar"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px' }}
        >
          <div className="live-loading-dot" />
          <span className="live-prompt">Loading pitching stats…</span>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FilterBar
        groups={PIT_ROLE_GROUPS}
        active={roleGroup}
        onSelect={setRoleGroup}
        teamFilter={teamFilter}
        onTeamChange={setTeamFilter}
        leagueFilter={leagueFilter}
        onLeagueChange={setLeagueFilter}
        minPA={minIP}
        onMinPAChange={setMinIP}
        qualifiedThreshold={qualifiedIP ?? undefined}
        label="Min IP"
        teams={allTeams}
        paOptionsList={[0, 5, 10, 20, 30, 40, 50, 60, 80, 100, 130]}
      />

      {leaderCards && (
        <div className="stat-grid-4">
          <StatCard
            label="fWAR Leader"
            value={leaderCards.byWar[0] ? dec1(leaderCards.byWar[0].war) : '—'}
            sub={leaderCards.byWar[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byWar[0]?.mlbId} size={32} />}
          />
          <StatCard
            label="ERA Leader"
            value={leaderCards.byEra[0] ? dec2(leaderCards.byEra[0].era) : '—'}
            sub={leaderCards.byEra[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byEra[0]?.mlbId} size={32} />}
          />
          <StatCard
            label="K% Leader"
            value={leaderCards.byK[0] ? pct(leaderCards.byK[0].kPct) : '—'}
            sub={leaderCards.byK[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byK[0]?.mlbId} size={32} />}
          />
          <StatCard
            label="FIP Leader"
            value={leaderCards.byFip[0] ? dec2(leaderCards.byFip[0].fip) : '—'}
            sub={leaderCards.byFip[0]?.name}
            icon={<PlayerAvatar mlbId={leaderCards.byFip[0]?.mlbId} size={32} />}
          />
        </div>
      )}

      <Card>
        <SortableTable
          data={mergedRows as any}
          columns={columns as any}
          rowKey="mlbId"
          defaultSort="war"
          defaultDir="desc"
          onRowClick={(row: any) => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name as string)}`)}
        />
      </Card>
    </div>
  );
}

// ─── LeaderboardPage ──────────────────────────────────────────────────────────


export default function LeaderboardPage() {
  const [tab, setTab] = useState<'hitting' | 'pitching'>('hitting');

  return (
    <div className="leaderboard-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-subtitle">
            MLB batting and pitching stats — FanGraphs + Baseball Savant
          </p>
        </div>
        <div className="page-header-controls">
          <div className="lb-main-tabs">
            <button
              className={`lb-main-tab${tab === 'hitting' ? ' lb-main-tab--active' : ''}`}
              onClick={() => setTab('hitting')}
            >
              Hitting
            </button>
            <button
              className={`lb-main-tab${tab === 'pitching' ? ' lb-main-tab--active' : ''}`}
              onClick={() => setTab('pitching')}
            >
              Pitching
            </button>
          </div>
        </div>
      </div>

      {/* FanGraphs attribution */}
      <FanGraphsBanner />

      {/* Leaderboard content (each owns its own filter bar + state) */}
      {tab === 'hitting' ? (
        <BattingLeaderboardWithFilters />
      ) : (
        <PitchingLeaderboardWithFilters />
      )}
    </div>
  );
}
