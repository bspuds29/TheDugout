import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import SortableTable from '../../components/ui/SortableTable';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import TeamLogo, { ABBR_TO_MLB_ID } from '../../components/ui/TeamLogo';
import { useBattingLeaderboard, usePitchingLeaderboard } from '../../hooks/useMLBData';
import type { FanGraphsBatterRow, FanGraphsPitcherRow } from '../../data/api/fangraphs';
import FanGraphsBanner from '../../components/ui/FanGraphsBanner';
import '../../styles/shared.css';
import './LeaderboardPage.css';

// Position groups for batters
const BAT_POS_GROUPS: { label: string; values: string[] }[] = [
  { label: 'All',  values: [] },
  { label: 'C',    values: ['C'] },
  { label: '1B',   values: ['1B'] },
  { label: '2B',   values: ['2B'] },
  { label: '3B',   values: ['3B'] },
  { label: 'SS',   values: ['SS'] },
  { label: 'OF',   values: ['LF','CF','RF','OF'] },
  { label: 'DH',   values: ['DH'] },
];

const PIT_ROLE_GROUPS: { label: string; values: string[] }[] = [
  { label: 'All', values: [] },
  { label: 'SP',  values: ['SP'] },
  { label: 'RP',  values: ['RP'] },
];

// ─── Helpers ─────────────────────────────────────────────────────────

const pct = (v: number) => `${v.toFixed(1)}%`;
const avg = (v: number) => v.toFixed(3);
const dec2 = (v: number) => v.toFixed(2);
const dec1 = (v: number) => v.toFixed(1);
const int  = (v: number) => Math.round(v).toString();

function colorPlus(v: number, neutral = 100) {
  if (v > neutral + 20) return 'var(--color-teal)';
  if (v > neutral + 5)  return '#22c55e';
  if (v < neutral - 20) return '#ef4444';
  if (v < neutral - 5)  return '#f59e0b';
  return 'var(--color-text-primary)';
}

function colorStat(v: number, goodHigh = true, threshold = 0) {
  if (goodHigh) return v > threshold ? 'var(--color-teal)' : v < threshold ? '#ef4444' : 'var(--color-text-secondary)';
  return v < threshold ? 'var(--color-teal)' : v > threshold ? '#ef4444' : 'var(--color-text-secondary)';
}

function posMatch(rowPos: string, filter: string[]): boolean {
  if (filter.length === 0) return true;
  const p = rowPos.toUpperCase();
  return filter.some(f => p.includes(f));
}

// ─── Rank renderer ────────────────────────────────────────────────────

function RankCell({ rank }: { rank: number }) {
  const color = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : 'var(--color-text-tertiary)';
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color, fontWeight: 700 }}>#{rank}</span>;
}

// ─── Name cell ────────────────────────────────────────────────────────

function NameCell({ name, mlbId, team }: { name: string; mlbId: number; team: string }) {
  const navigate = useNavigate();
  const teamId = ABBR_TO_MLB_ID[team?.toUpperCase()] ?? null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PlayerAvatar mlbId={mlbId} name={name} size={26} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}>{name}</div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: teamId ? 'pointer' : 'default' }}
          onClick={teamId ? (e) => { e.stopPropagation(); navigate(`/team/${teamId}`); } : undefined}
          title={teamId ? `View ${team} team page` : undefined}
        >
          <TeamLogo abbr={team} size={13} />
          <span style={{ fontSize: 10, color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{team}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────

function FilterBar({
  groups, active, onSelect,
  teamFilter, onTeamChange,
  minPA, onMinPAChange,
  label = 'PA',
  teams = [],
}: {
  groups: { label: string }[];
  active: string;
  onSelect: (s: string) => void;
  teamFilter: string;
  onTeamChange: (s: string) => void;
  minPA: number;
  onMinPAChange: (n: number) => void;
  label?: string;
  teams?: string[];
}) {
  return (
    <div className="lb-filter-bar">
      {/* Position tabs */}
      <div className="lb-tabs">
        {groups.map(g => (
          <button
            key={g.label}
            className={`lb-tab ${active === g.label ? 'lb-tab--active' : ''}`}
            onClick={() => onSelect(g.label)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Team select — options derived from actual data so abbreviations always match */}
      <select
        className="lb-select"
        value={teamFilter}
        onChange={e => onTeamChange(e.target.value)}
      >
        <option value="">All Teams</option>
        {teams.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Min PA/IP */}
      <select
        className="lb-select"
        value={minPA}
        onChange={e => onMinPAChange(Number(e.target.value))}
      >
        <option value={0}>All {label}</option>
        <option value={30}>≥30 {label}</option>
        <option value={50}>≥50 {label}</option>
        <option value={100}>≥100 {label}</option>
        <option value={150}>≥150 {label}</option>
        <option value={300}>≥300 {label}</option>
      </select>
    </div>
  );
}

// ─── Batting tab ─────────────────────────────────────────────────────

function BattingLeaderboard() {
  const [posGroup, setPosGroup] = useState('All');
  const [teamFilter, setTeamFilter] = useState('');
  const [minPA, setMinPA] = useState(50);

  const { data: raw = [], isLoading } = useBattingLeaderboard();

  const posValues = BAT_POS_GROUPS.find(g => g.label === posGroup)?.values ?? [];

  const rows = useMemo(() => {
    return raw.filter(r =>
      r.pa >= minPA &&
      posMatch(r.pos, posValues) &&
      (!teamFilter || r.team === teamFilter)
    );
  }, [raw, minPA, posValues, teamFilter]);

  // Leaders for summary cards
  const byHR   = [...rows].sort((a, b) => b.hr    - a.hr)[0];
  const byAVG  = [...rows].filter(r => r.pa >= 100).sort((a, b) => b.avg   - a.avg)[0];
  const byOPS  = [...rows].filter(r => r.pa >= 50).sort((a, b) => b.ops   - a.ops)[0];
  const byWAR  = [...rows].sort((a, b) => b.war   - a.war)[0];

  // Assign ranks (based on current sort: WAR by default)
  const ranked = useMemo(() =>
    [...rows].sort((a, b) => b.war - a.war).map((r, i) => ({ ...r, _rank: i + 1 }))
  , [rows]);

  if (isLoading) return (
    <div className="live-loading-bar">
      <span className="live-loading-dot" />
      Loading batting leaderboard from FanGraphs…
    </div>
  );

  return (
    <>
      <div className="stat-grid-4">
        <StatCard label="HR Leader"  value={byHR  ? int(byHR.hr)        : '—'} sub={byHR  ? byHR.name  : '—'} color="red"    accent />
        <StatCard label="AVG Leader" value={byAVG ? avg(byAVG.avg)      : '—'} sub={byAVG ? byAVG.name : '—'} color="accent" />
        <StatCard label="OPS Leader" value={byOPS ? avg(byOPS.ops)      : '—'} sub={byOPS ? byOPS.name : '—'} color="green"  />
        <StatCard label="WAR Leader" value={byWAR ? dec1(byWAR.war)     : '—'} sub={byWAR ? byWAR.name : '—'} color="purple" accent />
      </div>

      <Card title={`Batting Leaderboard`} subtitle={`${rows.length} qualified batters · ${new Date().getFullYear()} season · Source: FanGraphs`}>
        <SortableTable
          columns={[
            { key: '_rank',   label: '#',     align: 'center', render: v => <RankCell rank={Number(v)} /> },
            { key: 'name',    label: 'Player', align: 'left', sortable: true,
              render: (v, row: any) => <NameCell name={String(v)} mlbId={row.mlbId} team={row.team} /> },
            { key: 'pos',     label: 'Pos',   align: 'center',
              render: v => <span className="lb-pos-badge">{String(v).split('/')[0]}</span> },
            { key: 'g',       label: 'G',     sortable: true },
            { key: 'pa',      label: 'PA',    sortable: true },
            { key: 'hr',      label: 'HR',    sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Number(v) >= 10 ? '#ef4444' : 'inherit' }}>{int(Number(v))}</span> },
            { key: 'rbi',     label: 'RBI',   sortable: true },
            { key: 'sb',      label: 'SB',    sortable: true },
            { key: 'avg',     label: 'AVG',   sortable: true,
              render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'obp',     label: 'OBP',   sortable: true,
              render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'slg',     label: 'SLG',   sortable: true,
              render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'ops',     label: 'OPS',   sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 0.850 ? 'var(--color-teal)' : Number(v) <= 0.680 ? '#ef4444' : 'inherit', fontWeight: 600 }}>{avg(Number(v))}</span> },
            { key: 'woba',    label: 'wOBA',  sortable: true,
              render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'wrcPlus', label: 'wRC+',  sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: colorPlus(Number(v)) }}>{int(Number(v))}</span> },
            { key: 'kPct',    label: 'K%',    sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) > 28 ? '#ef4444' : Number(v) < 15 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'bbPct',   label: 'BB%',   sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) > 12 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'hardPct', label: 'Hard%', sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'barrelPct', label: 'Barrel%', sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) > 10 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'xwoba',   label: 'xwOBA', sortable: true,
              render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'war',     label: 'fWAR',  sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Number(v) >= 3 ? 'var(--color-teal)' : Number(v) < 0 ? '#ef4444' : 'inherit' }}>{dec1(Number(v))}</span> },
          ]}
          data={ranked as any}
          rowKey="mlbId"
          defaultSort="war"
        />
      </Card>
    </>
  );
}

// ─── Pitching tab ─────────────────────────────────────────────────────

function PitchingLeaderboard() {
  const [roleGroup, setRoleGroup] = useState('All');
  const [teamFilter, setTeamFilter] = useState('');
  const [minIP, setMinIP] = useState(10);

  const { data: raw = [], isLoading } = usePitchingLeaderboard();

  const roleValues = PIT_ROLE_GROUPS.find(g => g.label === roleGroup)?.values ?? [];

  const rows = useMemo(() => {
    return raw.filter(r =>
      r.ip >= minIP &&
      (roleValues.length === 0 || roleValues.includes(r.pos)) &&
      (!teamFilter || r.team === teamFilter)
    );
  }, [raw, minIP, roleValues, teamFilter]);

  const byERA  = [...rows].filter(r => r.ip >= 20).sort((a, b) => a.era  - b.era)[0];
  const byK    = [...rows].sort((a, b) => b.kPct - a.kPct)[0];
  const byWAR  = [...rows].sort((a, b) => b.war  - a.war)[0];
  const byXERA = [...rows].filter(r => r.ip >= 20).sort((a, b) => a.xera - b.xera)[0];

  const ranked = useMemo(() =>
    [...rows].sort((a, b) => b.war - a.war).map((r, i) => ({ ...r, _rank: i + 1 }))
  , [rows]);

  if (isLoading) return (
    <div className="live-loading-bar">
      <span className="live-loading-dot" />
      Loading pitching leaderboard from FanGraphs…
    </div>
  );

  return (
    <>
      <div className="stat-grid-4">
        <StatCard label="ERA Leader"  value={byERA  ? dec2(byERA.era)   : '—'} sub={byERA  ? byERA.name  : '—'} color="accent" accent />
        <StatCard label="K% Leader"   value={byK    ? pct(byK.kPct)     : '—'} sub={byK    ? byK.name    : '—'} color="green"  />
        <StatCard label="WAR Leader"  value={byWAR  ? dec1(byWAR.war)   : '—'} sub={byWAR  ? byWAR.name  : '—'} color="purple" accent />
        <StatCard label="xERA Leader" value={byXERA ? dec2(byXERA.xera) : '—'} sub={byXERA ? byXERA.name : '—'} color="teal"   />
      </div>

      <Card title="Pitching Leaderboard" subtitle={`${rows.length} qualified pitchers · ${new Date().getFullYear()} season · Source: FanGraphs`}>
        <SortableTable
          columns={[
            { key: '_rank',   label: '#',    align: 'center', render: v => <RankCell rank={Number(v)} /> },
            { key: 'name',    label: 'Player', align: 'left', sortable: true,
              render: (v, row: any) => <NameCell name={String(v)} mlbId={row.mlbId} team={row.team} /> },
            { key: 'pos',     label: 'Role', align: 'center',
              render: v => <span className="lb-pos-badge lb-pos-badge--pit">{String(v)}</span> },
            { key: 'g',       label: 'G',    sortable: true },
            { key: 'gs',      label: 'GS',   sortable: true },
            { key: 'ip',      label: 'IP',   sortable: true,
              render: v => <span className="mono">{dec1(Number(v))}</span> },
            { key: 'w',       label: 'W',    sortable: true },
            { key: 'sv',      label: 'SV',   sortable: true },
            { key: 'era',     label: 'ERA',  sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) <= 3.0 ? 'var(--color-teal)' : Number(v) >= 5.0 ? '#ef4444' : 'inherit', fontWeight: 600 }}>{dec2(Number(v))}</span> },
            { key: 'fip',     label: 'FIP',  sortable: true,
              render: v => <span className="mono">{dec2(Number(v))}</span> },
            { key: 'xfip',    label: 'xFIP', sortable: true,
              render: v => <span className="mono">{dec2(Number(v))}</span> },
            { key: 'xera',    label: 'xERA', sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) <= 3.0 ? 'var(--color-teal)' : 'inherit' }}>{dec2(Number(v))}</span> },
            { key: 'whip',    label: 'WHIP', sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) <= 1.0 ? 'var(--color-teal)' : Number(v) >= 1.40 ? '#ef4444' : 'inherit' }}>{dec2(Number(v))}</span> },
            { key: 'kPct',    label: 'K%',   sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 28 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'bbPct',   label: 'BB%',  sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 10 ? '#ef4444' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'kBBPct',  label: 'K-BB%',sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'gbPct',   label: 'GB%',  sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'swStrPct',label: 'SwStr%',sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 13 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'oSwingPct',label: 'Chase%',sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'war',     label: 'fWAR', sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Number(v) >= 2 ? 'var(--color-teal)' : Number(v) < 0 ? '#ef4444' : 'inherit' }}>{dec1(Number(v))}</span> },
          ]}
          data={ranked as any}
          rowKey="mlbId"
          defaultSort="war"
        />
      </Card>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

type Tab = 'hitting' | 'pitching';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('hitting');
  const [batPos,   setBatPos]   = useState('All');
  const [batTeam,  setBatTeam]  = useState('');
  const [batMinPA, setBatMinPA] = useState(50);
  const [pitRole,  setPitRole]  = useState('All');
  const [pitTeam,  setPitTeam]  = useState('');
  const [pitMinIP, setPitMinIP] = useState(10);

  // Derive available teams from real data so abbreviations always match FanGraphs exactly
  const { data: batRaw = [] } = useBattingLeaderboard();
  const { data: pitRaw = [] } = usePitchingLeaderboard();

  const batTeams = useMemo(() =>
    [...new Set(batRaw.map(r => r.team).filter(t => t && !/^\d/.test(t)))].sort()
  , [batRaw]);

  const pitTeams = useMemo(() =>
    [...new Set(pitRaw.map(r => r.team).filter(t => t && !/^\d/.test(t)))].sort()
  , [pitRaw]);

  return (
    <div className="leaderboard-page">
      <FanGraphsBanner />
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Statistical Leaderboard</h1>
          <p className="page-subtitle">
            Full MLB rankings for all batting and pitching stats · {new Date().getFullYear()} season
          </p>
        </div>
        <div className="page-header-controls">
          <div className="lb-main-tabs">
            <button
              className={`lb-main-tab ${tab === 'hitting' ? 'lb-main-tab--active' : ''}`}
              onClick={() => setTab('hitting')}
            >
              ⚾ Hitting
            </button>
            <button
              className={`lb-main-tab ${tab === 'pitching' ? 'lb-main-tab--active' : ''}`}
              onClick={() => setTab('pitching')}
            >
              🎯 Pitching
            </button>
          </div>
          <Badge variant="accent">{new Date().getFullYear()} Live</Badge>
        </div>
      </div>

      {/* Filters */}
      {tab === 'hitting' ? (
        <FilterBar
          groups={BAT_POS_GROUPS}
          active={batPos}
          onSelect={setBatPos}
          teamFilter={batTeam}
          onTeamChange={setBatTeam}
          minPA={batMinPA}
          onMinPAChange={setBatMinPA}
          label="PA"
          teams={batTeams}
        />
      ) : (
        <FilterBar
          groups={PIT_ROLE_GROUPS}
          active={pitRole}
          onSelect={setPitRole}
          teamFilter={pitTeam}
          onTeamChange={setPitTeam}
          minPA={pitMinIP}
          onMinPAChange={setPitMinIP}
          label="IP"
          teams={pitTeams}
        />
      )}

      {/* Content */}
      {tab === 'hitting' ? (
        <BattingLeaderboardWithFilters
          posGroup={batPos} teamFilter={batTeam} minPA={batMinPA}
        />
      ) : (
        <PitchingLeaderboardWithFilters
          roleGroup={pitRole} teamFilter={pitTeam} minIP={pitMinIP}
        />
      )}
    </div>
  );
}

// ─── Filter-aware wrappers ────────────────────────────────────────────

function BattingLeaderboardWithFilters({
  posGroup, teamFilter, minPA,
}: { posGroup: string; teamFilter: string; minPA: number }) {
  const navigate = useNavigate();
  const { data: raw = [], isLoading } = useBattingLeaderboard();
  const posValues = BAT_POS_GROUPS.find(g => g.label === posGroup)?.values ?? [];

  // When a specific team is selected, drop the PA threshold so all rostered players appear
  const effectiveMinPA = teamFilter ? 1 : minPA;

  const rows = useMemo(() =>
    raw.filter(r =>
      r.pa >= effectiveMinPA &&
      posMatch(r.pos, posValues) &&
      (!teamFilter || r.team === teamFilter)
    )
  , [raw, effectiveMinPA, posValues, teamFilter]);

  const ranked = useMemo(() =>
    [...rows].sort((a, b) => b.war - a.war).map((r, i) => ({ ...r, _rank: i + 1 }))
  , [rows]);

  const byHR   = [...rows].sort((a, b) => b.hr    - a.hr)[0];
  const byAVG  = [...rows].filter(r => r.pa >= 10).sort((a, b) => b.avg   - a.avg)[0];
  const byOPS  = [...rows].filter(r => r.pa >= 10).sort((a, b) => b.ops   - a.ops)[0];
  const byWAR  = [...rows].sort((a, b) => b.war   - a.war)[0];

  if (isLoading) return (
    <div className="live-loading-bar">
      <span className="live-loading-dot" />
      Loading batting leaderboard from FanGraphs…
    </div>
  );

  if (!rows.length) return (
    <div className="live-prompt">
      <div className="live-prompt-icon">⚾</div>
      <p>No batters match the current filters.</p>
    </div>
  );

  return (
    <>
      <div className="stat-grid-4">
        <StatCard label="HR Leader"  value={byHR  ? int(byHR.hr)    : '—'} sub={byHR  ? byHR.name  : '—'} color="red"    accent />
        <StatCard label="AVG Leader" value={byAVG ? avg(byAVG.avg)  : '—'} sub={byAVG ? byAVG.name : '—'} color="accent" />
        <StatCard label="OPS Leader" value={byOPS ? avg(byOPS.ops)  : '—'} sub={byOPS ? byOPS.name : '—'} color="green"  />
        <StatCard label="WAR Leader" value={byWAR ? dec1(byWAR.war) : '—'} sub={byWAR ? byWAR.name : '—'} color="purple" accent />
      </div>

      <Card
        title="Batting Leaderboard"
        subtitle={`${rows.length} qualified batters · ${new Date().getFullYear()} season · Source: FanGraphs`}
      >
        <SortableTable
          columns={[
            { key: '_rank',    label: '#',       align: 'center', render: v => <RankCell rank={Number(v)} /> },
            { key: 'name',     label: 'Player',  align: 'left', sortable: true,
              render: (v, row: any) => <NameCell name={String(v)} mlbId={row.mlbId} team={row.team} /> },
            { key: 'pos',      label: 'Pos',     align: 'center',
              render: v => <span className="lb-pos-badge">{String(v).split('/')[0]}</span> },
            { key: 'g',        label: 'G',       sortable: true },
            { key: 'pa',       label: 'PA',      sortable: true },
            { key: 'hr',       label: 'HR',      sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Number(v) >= 10 ? '#ef4444' : 'inherit' }}>{int(Number(v))}</span> },
            { key: 'rbi',      label: 'RBI',     sortable: true },
            { key: 'sb',       label: 'SB',      sortable: true },
            { key: 'avg',      label: 'AVG',     sortable: true, render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'obp',      label: 'OBP',     sortable: true, render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'slg',      label: 'SLG',     sortable: true, render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'ops',      label: 'OPS',     sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 0.850 ? 'var(--color-teal)' : Number(v) <= 0.680 ? '#ef4444' : 'inherit', fontWeight: 600 }}>{avg(Number(v))}</span> },
            { key: 'woba',     label: 'wOBA',    sortable: true, render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'wrcPlus',  label: 'wRC+',    sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: colorPlus(Number(v)) }}>{int(Number(v))}</span> },
            { key: 'kPct',     label: 'K%',      sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) > 28 ? '#ef4444' : Number(v) < 15 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'bbPct',    label: 'BB%',     sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) > 12 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'hardPct',  label: 'Hard%',   sortable: true, render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'barrelPct',label: 'Barrel%', sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) > 10 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'xwoba',    label: 'xwOBA',   sortable: true, render: v => <span className="mono">{avg(Number(v))}</span> },
            { key: 'war',      label: 'fWAR',    sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Number(v) >= 3 ? 'var(--color-teal)' : Number(v) < 0 ? '#ef4444' : 'inherit' }}>{dec1(Number(v))}</span> },
          ]}
          data={ranked as any}
          rowKey="mlbId"
          defaultSort="war"
          onRowClick={(row: any) => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name)}`)}
        />
      </Card>
    </>
  );
}

function PitchingLeaderboardWithFilters({
  roleGroup, teamFilter, minIP,
}: { roleGroup: string; teamFilter: string; minIP: number }) {
  const navigate = useNavigate();
  const { data: raw = [], isLoading } = usePitchingLeaderboard();
  const roleValues = PIT_ROLE_GROUPS.find(g => g.label === roleGroup)?.values ?? [];

  // Relax IP threshold when a specific team is selected
  const effectiveMinIP = teamFilter ? 0.1 : minIP;

  const rows = useMemo(() =>
    raw.filter(r =>
      r.ip >= effectiveMinIP &&
      (roleValues.length === 0 || roleValues.includes(r.pos)) &&
      (!teamFilter || r.team === teamFilter)
    )
  , [raw, effectiveMinIP, roleValues, teamFilter]);

  const ranked = useMemo(() =>
    [...rows].sort((a, b) => b.war - a.war).map((r, i) => ({ ...r, _rank: i + 1 }))
  , [rows]);

  const byERA  = [...rows].filter(r => r.ip >= 5).sort((a, b) => a.era  - b.era)[0];
  const byK    = [...rows].sort((a, b) => b.kPct - a.kPct)[0];
  const byWAR  = [...rows].sort((a, b) => b.war  - a.war)[0];
  const byXERA = [...rows].filter(r => r.ip >= 5).sort((a, b) => a.xera - b.xera)[0];

  if (isLoading) return (
    <div className="live-loading-bar">
      <span className="live-loading-dot" />
      Loading pitching leaderboard from FanGraphs…
    </div>
  );

  if (!rows.length) return (
    <div className="live-prompt">
      <div className="live-prompt-icon">🎯</div>
      <p>No pitchers match the current filters.</p>
    </div>
  );

  return (
    <>
      <div className="stat-grid-4">
        <StatCard label="ERA Leader"  value={byERA  ? dec2(byERA.era)   : '—'} sub={byERA  ? byERA.name  : '—'} color="accent" accent />
        <StatCard label="K% Leader"   value={byK    ? pct(byK.kPct)     : '—'} sub={byK    ? byK.name    : '—'} color="green"  />
        <StatCard label="WAR Leader"  value={byWAR  ? dec1(byWAR.war)   : '—'} sub={byWAR  ? byWAR.name  : '—'} color="purple" accent />
        <StatCard label="xERA Leader" value={byXERA ? dec2(byXERA.xera) : '—'} sub={byXERA ? byXERA.name : '—'} color="teal"   />
      </div>

      <Card
        title="Pitching Leaderboard"
        subtitle={`${rows.length} qualified pitchers · ${new Date().getFullYear()} season · Source: FanGraphs`}
      >
        <SortableTable
          columns={[
            { key: '_rank',    label: '#',      align: 'center', render: v => <RankCell rank={Number(v)} /> },
            { key: 'name',     label: 'Player', align: 'left', sortable: true,
              render: (v, row: any) => <NameCell name={String(v)} mlbId={row.mlbId} team={row.team} /> },
            { key: 'pos',      label: 'Role',   align: 'center',
              render: v => <span className="lb-pos-badge lb-pos-badge--pit">{String(v)}</span> },
            { key: 'g',        label: 'G',      sortable: true },
            { key: 'gs',       label: 'GS',     sortable: true },
            { key: 'ip',       label: 'IP',     sortable: true, render: v => <span className="mono">{dec1(Number(v))}</span> },
            { key: 'w',        label: 'W',      sortable: true },
            { key: 'sv',       label: 'SV',     sortable: true },
            { key: 'era',      label: 'ERA',    sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) <= 3.0 ? 'var(--color-teal)' : Number(v) >= 5.0 ? '#ef4444' : 'inherit', fontWeight: 600 }}>{dec2(Number(v))}</span> },
            { key: 'fip',      label: 'FIP',    sortable: true, render: v => <span className="mono">{dec2(Number(v))}</span> },
            { key: 'xfip',     label: 'xFIP',   sortable: true, render: v => <span className="mono">{dec2(Number(v))}</span> },
            { key: 'xera',     label: 'xERA',   sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) <= 3.0 ? 'var(--color-teal)' : 'inherit' }}>{dec2(Number(v))}</span> },
            { key: 'whip',     label: 'WHIP',   sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) <= 1.0 ? 'var(--color-teal)' : Number(v) >= 1.40 ? '#ef4444' : 'inherit' }}>{dec2(Number(v))}</span> },
            { key: 'kPct',     label: 'K%',     sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 28 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'bbPct',    label: 'BB%',    sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 10 ? '#ef4444' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'kBBPct',   label: 'K-BB%',  sortable: true, render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'gbPct',    label: 'GB%',    sortable: true, render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'swStrPct', label: 'SwStr%', sortable: true,
              render: v => <span className="mono" style={{ color: Number(v) >= 13 ? 'var(--color-teal)' : 'inherit' }}>{pct(Number(v))}</span> },
            { key: 'oSwingPct',label: 'Chase%', sortable: true, render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'war',      label: 'fWAR',   sortable: true,
              render: v => <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: Number(v) >= 2 ? 'var(--color-teal)' : Number(v) < 0 ? '#ef4444' : 'inherit' }}>{dec1(Number(v))}</span> },
          ]}
          data={ranked as any}
          rowKey="mlbId"
          defaultSort="war"
          onRowClick={(row: any) => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name)}`)}
        />
      </Card>
    </>
  );
}
