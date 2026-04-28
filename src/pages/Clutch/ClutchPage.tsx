import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import SortableTable from '../../components/ui/SortableTable';
import TeamLogo from '../../components/ui/TeamLogo';
import PlayerHeadshot from '../../components/ui/PlayerHeadshot';
import { useBattingLeaderboard, usePitchingLeaderboard } from '../../hooks/useMLBData';
import type { FanGraphsBatterRow } from '../../data/api/fangraphs';
import '../../styles/shared.css';
import './ClutchPage.css';

const YEAR = new Date().getFullYear();
const MIN_PA = 50;
const MIN_IP = 15;

// ─── Team colors (standard + FanGraphs variants) ──────────────────────

const TEAM_COLORS: Record<string, string> = {
  LAA: '#BA0021', ARI: '#A71930', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#c0c0c0', CHW: '#c0c0c0', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2340', HOU: '#002D62', KC:  '#004687', KCR: '#004687',
  LAD: '#005A9C', WSH: '#AB0003', WSN: '#AB0003', NYM: '#002D72', ATH: '#003831',
  OAK: '#003831', PIT: '#FDB827', SD:  '#2F241D', SDP: '#2F241D', SEA: '#0C2C56',
  SF:  '#FD5A1E', SFG: '#FD5A1E', STL: '#C41E3A', TB:  '#092C5C', TBR: '#092C5C',
  TEX: '#003278', TOR: '#134A8E', MIN: '#002B5C', PHI: '#E81828', ATL: '#CE1141',
  MIA: '#00A3E0', NYY: '#003087', MIL: '#12284B',
};

// ─── Custom tooltip ───────────────────────────────────────────────────

const WpaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value as number;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-row">
        <span style={{ color: val >= 0 ? '#20b2ff' : '#ef4444' }}>WPA:</span>
        <strong style={{ color: val >= 0 ? '#20b2ff' : '#ef4444' }}>
          {val >= 0 ? '+' : ''}{val.toFixed(2)}
        </strong>
      </div>
    </div>
  );
};

// ─── Shared cell renderers ────────────────────────────────────────────

function signedCell(decimals: number, neutral = 0) {
  return (v: unknown) => {
    const n = Number(v);
    const color = n > neutral ? '#22c55e' : n < -neutral ? '#ef4444' : 'var(--color-text-secondary)';
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, color }}>
        {n > 0 ? '+' : ''}{n.toFixed(decimals)}
      </span>
    );
  };
}

function monoCell(decimals = 3) {
  return (v: unknown) => (
    <span className="mono">{Number(v).toFixed(decimals)}</span>
  );
}

// ─── Player name cell ─────────────────────────────────────────────────

function NameCell({ name, team, pos, mlbId }: { name: string; team: string; pos: string; mlbId: number }) {
  return (
    <div className="clp-name-cell">
      <div className="clp-row-headshot">
        <PlayerHeadshot mlbId={mlbId} size={36} alt={name}
          style={{ borderRadius: '50%' }} />
      </div>
      <div>
        <div className="clp-player-name">{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {pos && <span className="clp-pos-badge">{pos}</span>}
          <span className="clp-team-abbr">{team}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────

function ProfileCard({ row, variant, onClick }: { row: FanGraphsBatterRow; variant: 'hero' | 'goat'; onClick?: () => void }) {
  const color = TEAM_COLORS[row.team] ?? '#20b2ff';
  const isPos = variant === 'hero';
  return (
    <div
      className={`clutch-profile-card ${isPos ? 'clutch-profile-card--pos' : 'clutch-profile-card--neg'}`}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="cpc-header">
        <div className="clp-headshot-wrap" style={{ borderColor: color }}>
          <PlayerHeadshot mlbId={row.mlbId} size={48} alt={row.name} />
        </div>
        <div className="cpc-info">
          <span className="cpc-name">{row.name}</span>
          <span className="cpc-meta">{row.pos || '—'} · {row.team}</span>
        </div>
        <div className={`cpc-score ${isPos ? 'cpc-score--pos' : 'cpc-score--neg'}`}>
          {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {row.clutch > 0 ? '+' : ''}{row.clutch.toFixed(2)}
        </div>
      </div>
      <div className="cpc-stats">
        <div className="cpc-stat">
          <span className="cpc-stat-label">WPA</span>
          <span className="cpc-stat-val" style={{ color: row.wpa >= 0 ? '#22c55e' : '#ef4444' }}>
            {row.wpa >= 0 ? '+' : ''}{row.wpa.toFixed(2)}
          </span>
        </div>
        <div className="cpc-stat">
          <span className="cpc-stat-label">RE24</span>
          <span className="cpc-stat-val" style={{ color: row.re24 >= 0 ? '#22c55e' : '#ef4444' }}>
            {row.re24 >= 0 ? '+' : ''}{row.re24.toFixed(1)}
          </span>
        </div>
        <div className="cpc-stat">
          <span className="cpc-stat-label">wRC+</span>
          <span className="cpc-stat-val">{row.wrcPlus}</span>
        </div>
        <div className="cpc-stat">
          <span className="cpc-stat-label">wOBA</span>
          <span className="cpc-stat-val">{row.woba.toFixed(3)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function ClutchPage() {
  const navigate = useNavigate();
  const toPlayer = (row: { mlbId: number; name: string }) =>
    navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name)}`);
  const [tab, setTab] = useState<'bat' | 'pit'>('bat');

  const { data: batRaw = [], isLoading: batLoading } = useBattingLeaderboard();
  const { data: pitRaw = [], isLoading: pitLoading } = usePitchingLeaderboard();

  const batters = useMemo(() => batRaw.filter(r => r.pa >= MIN_PA), [batRaw]);
  const pitchers = useMemo(() => pitRaw.filter(r => r.ip >= MIN_IP), [pitRaw]);

  const isLoading = tab === 'bat' ? batLoading : pitLoading;

  // Hero card stats (always from batters for Clutch-specific numbers)
  const wpaLeader  = useMemo(() => [...batters].sort((a, b) => b.wpa    - a.wpa)[0],    [batters]);
  const clutchLead = useMemo(() => [...batters].sort((a, b) => b.clutch - a.clutch)[0], [batters]);
  const re24Leader = useMemo(() => [...batters].sort((a, b) => b.re24   - a.re24)[0],   [batters]);

  // Bar chart — top 15 WPA for current tab
  const chartData = useMemo(() => {
    const src = tab === 'bat' ? batters : pitchers;
    return [...src]
      .sort((a, b) => b.wpa - a.wpa)
      .slice(0, 15)
      .map(r => ({
        name: r.name.split(' ').pop() ?? r.name,
        wpa:  r.wpa,
        fill: r.wpa >= 0 ? '#20b2ff' : '#ef4444',
      }));
  }, [tab, batters, pitchers]);

  // Profile cards — top/bottom 5 by Clutch score (batters only)
  const clutchSorted = useMemo(() => [...batters].sort((a, b) => b.clutch - a.clutch), [batters]);
  const top5 = clutchSorted.slice(0, 5);
  const bot5 = [...clutchSorted].reverse().slice(0, 5);

  // ── Table columns ────────────────────────────────────────────────────

  const batCols = [
    {
      key: 'name', label: 'Player', align: 'left' as const, sortable: true,
      render: (_: unknown, row: any) => <NameCell name={row.name} team={row.team} pos={row.pos} mlbId={row.mlbId} />,
    },
    { key: 'pa',      label: 'PA',     sortable: true, render: monoCell(0) },
    { key: 'clutch',  label: 'Clutch', sortable: true, render: signedCell(2, 0.5) },
    { key: 'wpa',     label: 'WPA',    sortable: true, render: signedCell(2, 0) },
    { key: 're24',    label: 'RE24',   sortable: true, render: signedCell(1, 5) },
    { key: 'wrcPlus', label: 'wRC+',   sortable: true, render: (v: unknown) => <span className="mono">{Number(v)}</span> },
    { key: 'woba',    label: 'wOBA',   sortable: true, render: monoCell(3) },
    { key: 'war',     label: 'WAR',    sortable: true, render: monoCell(1) },
  ];

  const pitCols = [
    {
      key: 'name', label: 'Player', align: 'left' as const, sortable: true,
      render: (_: unknown, row: any) => <NameCell name={row.name} team={row.team} pos={row.pos} mlbId={row.mlbId} />,
    },
    { key: 'ip',   label: 'IP',   sortable: true, render: monoCell(1) },
    { key: 'wpa',  label: 'WPA',  sortable: true, render: signedCell(2, 0) },
    { key: 're24', label: 'RE24', sortable: true, render: signedCell(1, 5) },
    { key: 'era',  label: 'ERA',  sortable: true, render: monoCell(2) },
    { key: 'fip',  label: 'FIP',  sortable: true, render: monoCell(2) },
    { key: 'kPct', label: 'K%',   sortable: true, render: (v: unknown) => <span className="mono">{Number(v).toFixed(1)}%</span> },
    { key: 'war',  label: 'WAR',  sortable: true, render: monoCell(1) },
  ];

  return (
    <div className="clutch-page">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clutch Analytics</h1>
          <p className="page-subtitle">WPA · RE24 · Clutch Score · {YEAR} Season</p>
        </div>
        <div className="page-header-controls">
          <div className="clp-tabs">
            <button
              className={`clp-tab${tab === 'bat' ? ' clp-tab--active' : ''}`}
              onClick={() => setTab('bat')}
            >Batters</button>
            <button
              className={`clp-tab${tab === 'pit' ? ' clp-tab--active' : ''}`}
              onClick={() => setTab('pit')}
            >Pitchers</button>
          </div>
          <Badge variant="amber">Pressure Metrics</Badge>
        </div>
      </div>

      {/* ── Explainer callout ────────────────────────────────────────────── */}
      <div className="clutch-explainer">
        <div className="clutch-explainer-icon"><Zap size={20} /></div>
        <div>
          <div className="clutch-explainer-title">Understanding Clutch Metrics</div>
          <div className="clutch-explainer-desc">
            <strong>WPA</strong> measures how much each plate appearance shifts the team's win probability — the ultimate "did it matter" stat.&ensp;
            <strong>RE24</strong> tracks runs above average based on the base-out state context of each AB.&ensp;
            <strong>Clutch Score</strong> (batters) is the difference between a player's WPA and their expected WPA given leverage — positive means rising to the moment.
            &ensp;Minimum <strong>{MIN_PA} PA</strong> / <strong>{MIN_IP} IP</strong> to qualify.
          </div>
        </div>
      </div>

      {/* ── Hero stat cards ──────────────────────────────────────────────── */}
      <div className="stat-grid-4">
        <StatCard
          label="WPA Leader (Bat)"
          value={wpaLeader ? `+${wpaLeader.wpa.toFixed(2)}` : '—'}
          sub={wpaLeader?.name ?? 'Loading…'}
          color="accent"
          accent
        />
        <StatCard
          label="Clutch Score Leader"
          value={clutchLead ? `+${clutchLead.clutch.toFixed(2)}` : '—'}
          sub={clutchLead?.name ?? 'Loading…'}
          color="green"
        />
        <StatCard
          label="RE24 Leader"
          value={re24Leader ? `+${re24Leader.re24.toFixed(1)}` : '—'}
          sub={re24Leader?.name ?? 'Loading…'}
          color="teal"
        />
        <StatCard
          label="Qualified"
          value={tab === 'bat' ? batters.length.toString() : pitchers.length.toString()}
          sub={tab === 'bat' ? `≥ ${MIN_PA} PA` : `≥ ${MIN_IP} IP`}
        />
      </div>

      {/* ── WPA bar chart ─────────────────────────────────────────────────── */}
      <Card
        title={`Top 15 WPA — ${tab === 'bat' ? 'Batters' : 'Pitchers'}`}
        subtitle={`Win Probability Added · ${YEAR} Season`}
      >
        {isLoading ? (
          <div className="clp-loading">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#7f93a8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4d6070', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<WpaTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar dataKey="wpa" name="WPA" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={chartData[i].fill} opacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Full leaderboard table ───────────────────────────────────────── */}
      <Card
        title={tab === 'bat' ? 'Batter Clutch Leaderboard' : 'Pitcher Leverage Leaderboard'}
        subtitle={tab === 'bat'
          ? `≥ ${MIN_PA} PA · ${batters.length} qualified batters`
          : `≥ ${MIN_IP} IP · ${pitchers.length} qualified pitchers`}
      >
        {isLoading ? (
          <div className="clp-loading">Loading…</div>
        ) : (
          <SortableTable
            columns={(tab === 'bat' ? batCols : pitCols) as any}
            data={(tab === 'bat' ? batters : pitchers) as any}
            rowKey="mlbId"
            defaultSort="wpa"
            defaultDir="desc"
            onRowClick={(row: any) => toPlayer(row)}
          />
        )}
      </Card>

      {/* ── Clutch Heroes ─────────────────────────────────────────────────── */}
      {tab === 'bat' && !batLoading && top5.length > 0 && (
        <>
          <div className="clp-section-label">
            <TrendingUp size={14} style={{ color: '#22c55e' }} />
            Clutch Heroes — Top 5 by Clutch Score
          </div>
          <div className="clutch-cards-grid">
            {top5.map(r => <ProfileCard key={r.mlbId} row={r} variant="hero" onClick={() => toPlayer(r)} />)}
          </div>
        </>
      )}

      {/* ── Clutch Goats ──────────────────────────────────────────────────── */}
      {tab === 'bat' && !batLoading && bot5.length > 0 && (
        <>
          <div className="clp-section-label">
            <TrendingDown size={14} style={{ color: '#ef4444' }} />
            Clutch Goats — Bottom 5 by Clutch Score
          </div>
          <div className="clutch-cards-grid">
            {bot5.map(r => <ProfileCard key={r.mlbId} row={r} variant="goat" onClick={() => toPlayer(r)} />)}
          </div>
        </>
      )}

    </div>
  );
}
