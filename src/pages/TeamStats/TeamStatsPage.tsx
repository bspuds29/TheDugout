import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import SortableTable from '../../components/ui/SortableTable';
import Badge from '../../components/ui/Badge';
import TeamLogo, { ABBR_TO_MLB_ID } from '../../components/ui/TeamLogo';
import { useBattingLeaderboard, usePitchingLeaderboard } from '../../hooks/useMLBData';
import type { FanGraphsBatterRow, FanGraphsPitcherRow } from '../../data/api/fangraphs';
import '../../styles/shared.css';
import './TeamStatsPage.css';

const YEAR = new Date().getFullYear();

// ─── Team display maps ────────────────────────────────────────────────

const TEAM_NAMES: Record<string, string> = {
  ARI: 'Diamondbacks', ATL: 'Braves',    BAL: 'Orioles',    BOS: 'Red Sox',
  CHC: 'Cubs',         CWS: 'White Sox', CIN: 'Reds',       CLE: 'Guardians',
  COL: 'Rockies',      DET: 'Tigers',    HOU: 'Astros',     KC:  'Royals',
  LAA: 'Angels',       LAD: 'Dodgers',   MIA: 'Marlins',    MIL: 'Brewers',
  MIN: 'Twins',        NYM: 'Mets',      NYY: 'Yankees',    ATH: 'Athletics',
  OAK: 'Athletics',    PHI: 'Phillies',  PIT: 'Pirates',    SD:  'Padres',
  SEA: 'Mariners',     SF:  'Giants',    STL: 'Cardinals',  TB:  'Rays',
  TEX: 'Rangers',      TOR: 'Blue Jays', WSH: 'Nationals',
  // FanGraphs abbreviation variants
  CHW: 'White Sox',    KCR: 'Royals',    SDP: 'Padres',
  SFG: 'Giants',       TBR: 'Rays',      WSN: 'Nationals',
};

const TEAM_COLORS: Record<string, string> = {
  LAA: '#BA0021', ARI: '#A71930', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#c0c0c0', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2340', HOU: '#002D62', KC:  '#004687',
  LAD: '#005A9C', WSH: '#AB0003', NYM: '#002D72', ATH: '#003831',
  OAK: '#003831', PIT: '#FDB827', SD:  '#2F241D', SEA: '#0C2C56',
  SF:  '#FD5A1E', STL: '#C41E3A', TB:  '#092C5C', TEX: '#003278',
  TOR: '#134A8E', MIN: '#002B5C', PHI: '#E81828', ATL: '#CE1141',
  MIA: '#00A3E0', NYY: '#003087', MIL: '#12284B',
  // FanGraphs abbreviation variants
  CHW: '#c0c0c0', KCR: '#004687', SDP: '#2F241D',
  SFG: '#FD5A1E', TBR: '#092C5C', WSN: '#AB0003',
};

// ─── Team aggregation types ───────────────────────────────────────────

interface TeamBattingRow {
  team:       string;
  pa:         number;
  hr:         number;
  r:          number;
  rbi:        number;
  sb:         number;
  avg:        number;
  obp:        number;
  slg:        number;
  ops:        number;
  woba:       number;
  xwoba:      number;
  wrcPlus:    number;
  kPct:       number;
  bbPct:      number;
  hardPct:    number;
  barrelPct:  number;
  exitVelo:   number;
  war:        number;
  players:    number;
}

interface TeamPitchingRow {
  team:       string;
  ip:         number;
  w:          number;
  l:          number;
  sv:         number;
  era:        number;
  fip:        number;
  xfip:       number;
  xera:       number;
  whip:       number;
  kPct:       number;
  bbPct:      number;
  kBBPct:     number;
  gbPct:      number;
  swStrPct:   number;
  oSwingPct:  number;
  war:        number;
  pitchers:   number;
}

// ─── Aggregation helpers ──────────────────────────────────────────────

/** Skip multi-team rows (e.g. "2TM", "3TM") */
function isMultiTeam(team: string): boolean {
  return /\dTM$/i.test(team);
}

function aggregateBatting(rows: FanGraphsBatterRow[]): TeamBattingRow[] {
  const map = new Map<string, FanGraphsBatterRow[]>();
  for (const r of rows) {
    if (!r.team || isMultiTeam(r.team)) continue;
    if (!map.has(r.team)) map.set(r.team, []);
    map.get(r.team)!.push(r);
  }

  return Array.from(map.entries()).map(([team, players]) => {
    const totalPA = players.reduce((s, p) => s + p.pa, 0) || 1;
    const wavg = (fn: (p: FanGraphsBatterRow) => number) =>
      players.reduce((s, p) => s + fn(p) * p.pa, 0) / totalPA;

    const obp = wavg(p => p.obp);
    const slg = wavg(p => p.slg);

    // EV: only PA where EV > 0 to avoid zeroes dragging average
    const evPlayers = players.filter(p => p.exitVelo > 0);
    const evPA = evPlayers.reduce((s, p) => s + p.pa, 0) || 1;
    const exitVelo = evPlayers.reduce((s, p) => s + p.exitVelo * p.pa, 0) / evPA;

    return {
      team,
      pa:        totalPA,
      hr:        players.reduce((s, p) => s + p.hr,  0),
      r:         players.reduce((s, p) => s + p.r,   0),
      rbi:       players.reduce((s, p) => s + p.rbi, 0),
      sb:        players.reduce((s, p) => s + p.sb,  0),
      avg:       Math.round(wavg(p => p.avg)  * 1000) / 1000,
      obp:       Math.round(obp               * 1000) / 1000,
      slg:       Math.round(slg               * 1000) / 1000,
      ops:       Math.round((obp + slg)        * 1000) / 1000,
      woba:      Math.round(wavg(p => p.woba)  * 1000) / 1000,
      xwoba:     Math.round(wavg(p => p.xwoba) * 1000) / 1000,
      wrcPlus:   Math.round(wavg(p => p.wrcPlus)),
      kPct:      Math.round(wavg(p => p.kPct)      * 10) / 10,
      bbPct:     Math.round(wavg(p => p.bbPct)     * 10) / 10,
      hardPct:   Math.round(wavg(p => p.hardPct)   * 10) / 10,
      barrelPct: Math.round(wavg(p => p.barrelPct) * 10) / 10,
      exitVelo:  Math.round(exitVelo * 10) / 10,
      war:       Math.round(players.reduce((s, p) => s + p.war, 0) * 10) / 10,
      players:   players.length,
    };
  });
}

function aggregatePitching(rows: FanGraphsPitcherRow[]): TeamPitchingRow[] {
  const map = new Map<string, FanGraphsPitcherRow[]>();
  for (const r of rows) {
    if (!r.team || isMultiTeam(r.team)) continue;
    if (!map.has(r.team)) map.set(r.team, []);
    map.get(r.team)!.push(r);
  }

  return Array.from(map.entries()).map(([team, pitchers]) => {
    const totalIP = pitchers.reduce((s, p) => s + p.ip, 0) || 1;
    const wavg = (fn: (p: FanGraphsPitcherRow) => number) =>
      pitchers.reduce((s, p) => s + fn(p) * p.ip, 0) / totalIP;

    return {
      team,
      ip:        Math.round(totalIP * 10) / 10,
      w:         pitchers.reduce((s, p) => s + p.w,  0),
      l:         pitchers.reduce((s, p) => s + p.l,  0),
      sv:        pitchers.reduce((s, p) => s + p.sv, 0),
      era:       Math.round(wavg(p => p.era)       * 100) / 100,
      fip:       Math.round(wavg(p => p.fip)       * 100) / 100,
      xfip:      Math.round(wavg(p => p.xfip)      * 100) / 100,
      xera:      Math.round(wavg(p => p.xera)      * 100) / 100,
      whip:      Math.round(wavg(p => p.whip)      * 100) / 100,
      kPct:      Math.round(wavg(p => p.kPct)      * 10)  / 10,
      bbPct:     Math.round(wavg(p => p.bbPct)     * 10)  / 10,
      kBBPct:    Math.round(wavg(p => p.kBBPct)    * 10)  / 10,
      gbPct:     Math.round(wavg(p => p.gbPct)     * 10)  / 10,
      swStrPct:  Math.round(wavg(p => p.swStrPct)  * 10)  / 10,
      oSwingPct: Math.round(wavg(p => p.oSwingPct) * 10)  / 10,
      war:       Math.round(pitchers.reduce((s, p) => s + p.war, 0) * 10) / 10,
      pitchers:  pitchers.length,
    };
  });
}

// ─── Formatters ────────────────────────────────────────────────────────

const avg3 = (v: number) => v.toFixed(3);
const d2   = (v: number) => v.toFixed(2);
const d1   = (v: number) => v.toFixed(1);
const pct  = (v: number) => `${v.toFixed(1)}%`;
const int  = (v: number) => Math.round(v).toString();

function colorHigh(v: number, hi: number, lo: number): string {
  if (v >= hi) return 'var(--color-teal)';
  if (v <= lo) return '#ef4444';
  return 'inherit';
}
function colorLow(v: number, good: number, bad: number): string {
  if (v <= good) return 'var(--color-teal)';
  if (v >= bad)  return '#ef4444';
  return 'inherit';
}
function colorWRC(v: number): string {
  if (v >= 115) return 'var(--color-teal)';
  if (v >= 105) return '#22c55e';
  if (v <= 85)  return '#ef4444';
  if (v <= 95)  return '#f59e0b';
  return 'inherit';
}

// ─── Team name cell ────────────────────────────────────────────────────

function TeamCell({ team }: { team: string }) {
  const navigate = useNavigate();
  const color  = TEAM_COLORS[team] ?? '#1e293b';
  const name   = TEAM_NAMES[team]  ?? team;
  const teamId = ABBR_TO_MLB_ID[team?.toUpperCase()] ?? null;
  return (
    <div
      className="ts-team-cell"
      style={{ cursor: teamId ? 'pointer' : 'default' }}
      onClick={teamId ? () => navigate(`/team/${teamId}`) : undefined}
      title={teamId ? `View ${name} team page` : undefined}
    >
      <div className="ts-team-logo-wrap" style={{ borderColor: color }}>
        <TeamLogo abbr={team} size={22} />
      </div>
      <div>
        <div className="ts-team-name">{name}</div>
        <div className="ts-team-abbr">{team}</div>
      </div>
    </div>
  );
}

// ─── Rank cell ────────────────────────────────────────────────────────

function RankCell({ rank }: { rank: number }) {
  const color = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : 'var(--color-text-tertiary)';
  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color, fontWeight: 700 }}>#{rank}</span>;
}

// ─── Batting tab ──────────────────────────────────────────────────────

function TeamBattingTab() {
  const { data: raw = [], isLoading } = useBattingLeaderboard();

  const teams = useMemo(() => aggregateBatting(raw), [raw]);
  const ranked = useMemo(
    () => [...teams].sort((a, b) => b.war - a.war).map((r, i) => ({ ...r, _rank: i + 1 })),
    [teams]
  );

  const byHR   = [...teams].sort((a, b) => b.hr      - a.hr)[0];
  const byOPS  = [...teams].sort((a, b) => b.ops      - a.ops)[0];
  const byWRC  = [...teams].sort((a, b) => b.wrcPlus  - a.wrcPlus)[0];
  const byWAR  = [...teams].sort((a, b) => b.war      - a.war)[0];
  const worstK = [...teams].sort((a, b) => b.kPct - a.kPct)[0];

  if (isLoading) return (
    <div className="live-loading-bar">
      <span className="live-loading-dot" />
      Aggregating team batting stats from FanGraphs…
    </div>
  );

  if (!teams.length) return (
    <div className="live-prompt">
      <div className="live-prompt-icon">⚾</div>
      <p>No batting data available yet.</p>
    </div>
  );

  return (
    <>
      <div className="stat-grid-4">
        <StatCard label="HR Leader"   value={byHR   ? int(byHR.hr)          : '—'} sub={byHR   ? `${byHR.team}  · ${TEAM_NAMES[byHR.team] ?? ''}`   : '—'} color="red"    accent />
        <StatCard label="OPS Leader"  value={byOPS  ? avg3(byOPS.ops)        : '—'} sub={byOPS  ? `${byOPS.team} · ${TEAM_NAMES[byOPS.team] ?? ''}`  : '—'} color="green"  />
        <StatCard label="wRC+ Leader" value={byWRC  ? int(byWRC.wrcPlus)     : '—'} sub={byWRC  ? `${byWRC.team} · ${TEAM_NAMES[byWRC.team] ?? ''}`  : '—'} color="teal"   accent />
        <StatCard label="WAR Leader"  value={byWAR  ? d1(byWAR.war)          : '—'} sub={byWAR  ? `${byWAR.team} · ${TEAM_NAMES[byWAR.team] ?? ''}`  : '—'} color="purple" accent />
      </div>

      <Card
        title="Team Batting Leaderboard"
        subtitle={`${teams.length} teams · ${YEAR} season · PA-weighted rates · Source: FanGraphs`}
      >
        <SortableTable
          columns={[
            { key: '_rank',    label: '#',       align: 'center', render: v => <RankCell rank={Number(v)} /> },
            { key: 'team',     label: 'Team',    align: 'left',   sortable: true,
              render: v => <TeamCell team={String(v)} /> },
            { key: 'pa',       label: 'PA',      sortable: true },
            { key: 'hr',       label: 'HR',      sortable: true,
              render: v => <span className="mono" style={{ fontWeight: 700, color: Number(v) >= 30 ? '#ef4444' : 'inherit' }}>{int(Number(v))}</span> },
            { key: 'r',        label: 'R',       sortable: true },
            { key: 'rbi',      label: 'RBI',     sortable: true },
            { key: 'sb',       label: 'SB',      sortable: true },
            { key: 'avg',      label: 'AVG',     sortable: true,
              render: v => <span className="mono">{avg3(Number(v))}</span> },
            { key: 'obp',      label: 'OBP',     sortable: true,
              render: v => <span className="mono">{avg3(Number(v))}</span> },
            { key: 'slg',      label: 'SLG',     sortable: true,
              render: v => <span className="mono">{avg3(Number(v))}</span> },
            { key: 'ops',      label: 'OPS',     sortable: true,
              render: v => <span className="mono" style={{ fontWeight: 600, color: colorHigh(Number(v), 0.760, 0.690) }}>{avg3(Number(v))}</span> },
            { key: 'woba',     label: 'wOBA',    sortable: true,
              render: v => <span className="mono">{avg3(Number(v))}</span> },
            { key: 'wrcPlus',  label: 'wRC+',    sortable: true,
              render: v => <span className="mono" style={{ fontWeight: 700, color: colorWRC(Number(v)) }}>{int(Number(v))}</span> },
            { key: 'kPct',     label: 'K%',      sortable: true,
              render: v => <span className="mono" style={{ color: colorLow(Number(v), 20, 25) }}>{pct(Number(v))}</span> },
            { key: 'bbPct',    label: 'BB%',     sortable: true,
              render: v => <span className="mono" style={{ color: colorHigh(Number(v), 10, 7) }}>{pct(Number(v))}</span> },
            { key: 'hardPct',  label: 'Hard%',   sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'barrelPct',label: 'Barrel%', sortable: true,
              render: v => <span className="mono" style={{ color: colorHigh(Number(v), 8, 5) }}>{pct(Number(v))}</span> },
            { key: 'exitVelo', label: 'EV',      sortable: true,
              render: v => <span className="mono">{Number(v) > 0 ? d1(Number(v)) : '—'}</span> },
            { key: 'xwoba',    label: 'xwOBA',   sortable: true,
              render: v => <span className="mono">{avg3(Number(v))}</span> },
            { key: 'war',      label: 'fWAR',    sortable: true,
              render: v => <span className="mono" style={{ fontWeight: 700, color: colorHigh(Number(v), 10, 3) }}>{d1(Number(v))}</span> },
          ]}
          data={ranked as any}
          rowKey="team"
          defaultSort="war"
        />
      </Card>

      {worstK && (
        <div className="ts-insight">
          <span className="ts-insight-icon">📊</span>
          <span>
            <strong>{worstK.team}</strong> ({TEAM_NAMES[worstK.team]}) lead MLB with the highest team K% at{' '}
            <strong>{pct(worstK.kPct)}</strong>.
          </span>
        </div>
      )}
    </>
  );
}

// ─── Pitching tab ─────────────────────────────────────────────────────

function TeamPitchingTab() {
  const { data: raw = [], isLoading } = usePitchingLeaderboard();

  const teams = useMemo(() => aggregatePitching(raw), [raw]);
  const ranked = useMemo(
    () => [...teams].sort((a, b) => b.war - a.war).map((r, i) => ({ ...r, _rank: i + 1 })),
    [teams]
  );

  const byERA  = [...teams].filter(t => t.ip >= 50).sort((a, b) => a.era  - b.era)[0];
  const byFIP  = [...teams].filter(t => t.ip >= 50).sort((a, b) => a.fip  - b.fip)[0];
  const byK    = [...teams].sort((a, b) => b.kPct - a.kPct)[0];
  const byWAR  = [...teams].sort((a, b) => b.war  - a.war)[0];

  if (isLoading) return (
    <div className="live-loading-bar">
      <span className="live-loading-dot" />
      Aggregating team pitching stats from FanGraphs…
    </div>
  );

  if (!teams.length) return (
    <div className="live-prompt">
      <div className="live-prompt-icon">🎯</div>
      <p>No pitching data available yet.</p>
    </div>
  );

  return (
    <>
      <div className="stat-grid-4">
        <StatCard label="ERA Leader"  value={byERA ? d2(byERA.era)  : '—'} sub={byERA ? `${byERA.team} · ${TEAM_NAMES[byERA.team] ?? ''}` : '—'} color="accent" accent />
        <StatCard label="FIP Leader"  value={byFIP ? d2(byFIP.fip)  : '—'} sub={byFIP ? `${byFIP.team} · ${TEAM_NAMES[byFIP.team] ?? ''}` : '—'} color="green"  />
        <StatCard label="K% Leader"   value={byK   ? pct(byK.kPct)  : '—'} sub={byK   ? `${byK.team}   · ${TEAM_NAMES[byK.team]   ?? ''}` : '—'} color="teal"   accent />
        <StatCard label="WAR Leader"  value={byWAR ? d1(byWAR.war)  : '—'} sub={byWAR ? `${byWAR.team} · ${TEAM_NAMES[byWAR.team] ?? ''}` : '—'} color="purple" accent />
      </div>

      <Card
        title="Team Pitching Leaderboard"
        subtitle={`${teams.length} teams · ${YEAR} season · IP-weighted rates · Source: FanGraphs`}
      >
        <SortableTable
          columns={[
            { key: '_rank',    label: '#',       align: 'center', render: v => <RankCell rank={Number(v)} /> },
            { key: 'team',     label: 'Team',    align: 'left',   sortable: true,
              render: v => <TeamCell team={String(v)} /> },
            { key: 'ip',       label: 'IP',      sortable: true,
              render: v => <span className="mono">{d1(Number(v))}</span> },
            { key: 'w',        label: 'W',       sortable: true },
            { key: 'l',        label: 'L',       sortable: true },
            { key: 'sv',       label: 'SV',      sortable: true },
            { key: 'era',      label: 'ERA',     sortable: true,
              render: v => <span className="mono" style={{ fontWeight: 600, color: colorLow(Number(v), 3.5, 4.8) }}>{d2(Number(v))}</span> },
            { key: 'fip',      label: 'FIP',     sortable: true,
              render: v => <span className="mono" style={{ color: colorLow(Number(v), 3.5, 4.5) }}>{d2(Number(v))}</span> },
            { key: 'xfip',     label: 'xFIP',    sortable: true,
              render: v => <span className="mono">{d2(Number(v))}</span> },
            { key: 'xera',     label: 'xERA',    sortable: true,
              render: v => <span className="mono" style={{ color: colorLow(Number(v), 3.5, 4.5) }}>{d2(Number(v))}</span> },
            { key: 'whip',     label: 'WHIP',    sortable: true,
              render: v => <span className="mono" style={{ color: colorLow(Number(v), 1.15, 1.40) }}>{d2(Number(v))}</span> },
            { key: 'kPct',     label: 'K%',      sortable: true,
              render: v => <span className="mono" style={{ color: colorHigh(Number(v), 25, 20) }}>{pct(Number(v))}</span> },
            { key: 'bbPct',    label: 'BB%',     sortable: true,
              render: v => <span className="mono" style={{ color: colorLow(Number(v), 8, 11) }}>{pct(Number(v))}</span> },
            { key: 'kBBPct',   label: 'K-BB%',   sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'gbPct',    label: 'GB%',     sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'swStrPct', label: 'SwStr%',  sortable: true,
              render: v => <span className="mono" style={{ color: colorHigh(Number(v), 12, 9) }}>{pct(Number(v))}</span> },
            { key: 'oSwingPct',label: 'Chase%',  sortable: true,
              render: v => <span className="mono">{pct(Number(v))}</span> },
            { key: 'war',      label: 'fWAR',    sortable: true,
              render: v => <span className="mono" style={{ fontWeight: 700, color: colorHigh(Number(v), 8, 2) }}>{d1(Number(v))}</span> },
          ]}
          data={ranked as any}
          rowKey="team"
          defaultSort="war"
        />
      </Card>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

type Tab = 'batting' | 'pitching';

export default function TeamStatsPage() {
  const [tab, setTab] = useState<Tab>('batting');

  return (
    <div className="team-stats-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Statistics</h1>
          <p className="page-subtitle">
            MLB team batting &amp; pitching rankings · {YEAR} season · Source: FanGraphs
          </p>
        </div>
        <div className="page-header-controls">
          <div className="ts-main-tabs">
            <button
              className={`ts-main-tab ${tab === 'batting'  ? 'ts-main-tab--active' : ''}`}
              onClick={() => setTab('batting')}
            >
              ⚾ Batting
            </button>
            <button
              className={`ts-main-tab ${tab === 'pitching' ? 'ts-main-tab--active' : ''}`}
              onClick={() => setTab('pitching')}
            >
              🎯 Pitching
            </button>
          </div>
          <Badge variant="accent">{YEAR} Live</Badge>
        </div>
      </div>

      {tab === 'batting'  ? <TeamBattingTab  /> : <TeamPitchingTab />}
    </div>
  );
}
