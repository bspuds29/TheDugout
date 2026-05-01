import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import InsightPanel from '../../components/ui/InsightPanel';
import SortableTable from '../../components/ui/SortableTable';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import { useDefenseLeaderboard } from '../../hooks/useMLBData';
import type { FanGraphsFieldingStats } from '../../data/api/fangraphs';
import FanGraphsBanner from '../../components/ui/FanGraphsBanner';
import '../../styles/shared.css';
import './DefensePage.css';

// ─── Position groups ─────────────────────────────────────────────────

const POS_GROUPS: Record<string, string[]> = {
  All:  [],
  'C':  ['C'],
  'IF': ['1B','2B','3B','SS'],
  'OF': ['LF','CF','RF'],
};

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(v: number | null, decimals = 1, showPlus = false): string {
  if (v === null || v === undefined) return '—';
  const n = Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const s = n.toFixed(decimals);
  return showPlus && n > 0 ? `+${s}` : s;
}

function fmtFP(v: number): string {
  if (!v) return '—';
  return v.toFixed(3);
}

function colorVal(v: number | null) {
  if (v === null) return 'var(--color-text-tertiary)';
  if (v > 0) return 'var(--color-teal)';
  if (v < 0) return '#ef4444';
  return 'var(--color-text-secondary)';
}

// ─── Tooltip ─────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong>{typeof p.value === 'number' ? (p.value > 0 ? '+' : '') + p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Insights builder ────────────────────────────────────────────────

function buildInsights(rows: FanGraphsFieldingStats[]) {
  const withOAA  = rows.filter(r => r.oaa !== null);
  const withDRS  = rows.filter(r => r.drs !== null);
  const insights: Array<{ type: 'info'|'positive'|'warning'|'tip'; text: string }> = [
    { type: 'info', text: 'Live data sourced from FanGraphs. OAA (Outs Above Average) is Statcast-based; DRS is Sports Info Solutions.' },
  ];

  if (withOAA.length > 0) {
    const best = withOAA.reduce((a, b) => (a.oaa ?? -99) > (b.oaa ?? -99) ? a : b);
    insights.push({ type: 'positive', text: `${best.name} leads all fielders with OAA of ${fmt(best.oaa, 0, true)} (${best.pos}).` });
    const worst = withOAA.reduce((a, b) => (a.oaa ?? 99) < (b.oaa ?? 99) ? a : b);
    if ((worst.oaa ?? 0) < -5)
      insights.push({ type: 'warning', text: `${worst.name} has the lowest OAA at ${fmt(worst.oaa, 0, true)} — well below average range (${worst.pos}).` });
  }
  if (withDRS.length > 0) {
    const bestDRS = withDRS.reduce((a, b) => (a.drs ?? -99) > (b.drs ?? -99) ? a : b);
    insights.push({ type: 'positive', text: `${bestDRS.name} leads in DRS with ${fmt(bestDRS.drs, 0, true)} runs saved (${bestDRS.pos}).` });
  }
  insights.push({ type: 'tip', text: 'Use OAA + DRS together for most reliable defensive evaluation. Single-season samples can be noisy — 3-year averages are more stable.' });
  return insights;
}

// ─── Main page ────────────────────────────────────────────────────────

export default function DefensePage() {
  const navigate = useNavigate();
  const [posFilter, setPosFilter] = useState<string>('All');
  const [chartMetric, setChartMetric] = useState<'oaa' | 'drs' | 'defense'>('oaa');
  const YEAR = new Date().getFullYear();

  const { data: leaderboard = [], isLoading } = useDefenseLeaderboard();

  // Filter by position group
  const filtered = useMemo(() => {
    const allowed = POS_GROUPS[posFilter];
    const base = allowed.length === 0
      ? leaderboard
      : leaderboard.filter(r => allowed.includes(r.pos));
    // Deduplicate: keep highest-game entry per player (some players appear at multiple positions)
    const seen = new Map<number, FanGraphsFieldingStats>();
    base.forEach(r => {
      const ex = seen.get(r.mlbId);
      if (!ex || r.games > ex.games) seen.set(r.mlbId, r);
    });
    return Array.from(seen.values());
  }, [leaderboard, posFilter]);

  // Top 15 by selected metric for the chart
  const chartData = useMemo(() => {
    return [...filtered]
      .filter(r => r[chartMetric] !== null)
      .sort((a, b) => (b[chartMetric] as number) - (a[chartMetric] as number))
      .slice(0, 15)
      .map(r => ({
        name: r.name.split(' ').pop() ?? r.name,   // last name only
        fullName: r.name,
        pos: r.pos,
        value: r[chartMetric] as number,
      }));
  }, [filtered, chartMetric]);

  // Summary cards
  const withOAA  = filtered.filter(r => r.oaa  !== null);
  const withDRS  = filtered.filter(r => r.drs  !== null);
  const topOAA   = withOAA.length  ? withOAA.reduce((a, b)  => (a.oaa  ?? -99) > (b.oaa  ?? -99)  ? a : b) : null;
  const topDRS   = withDRS.length  ? withDRS.reduce((a, b)  => (a.drs  ?? -99) > (b.drs  ?? -99)  ? a : b) : null;
  const withUZR150 = filtered.filter(r => r.uzr150 !== null);
  const topUZR   = withUZR150.length ? withUZR150.reduce((a, b) => (a.uzr150 ?? -99) > (b.uzr150 ?? -99) ? a : b) : null;
  const topDef   = filtered.filter(r => r.defense !== null).sort((a, b) => (b.defense ?? 0) - (a.defense ?? 0))[0] ?? null;

  const insights = useMemo(() => buildInsights(filtered), [filtered]);

  const METRIC_LABELS: Record<string, string> = {
    oaa: 'OAA',
    drs: 'DRS',
    defense: 'Defense',
  };

  return (
    <div className="defense-page">
      <FanGraphsBanner />
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Defensive Leaderboard</h1>
          <p className="page-subtitle">OAA · DRS · UZR · Defense — {YEAR} MLB season · Source: FanGraphs</p>
        </div>
        <div className="page-header-controls">
          {/* Position filter */}
          <div className="def-pos-tabs">
            {Object.keys(POS_GROUPS).map(p => (
              <button
                key={p}
                className={`def-pos-tab ${posFilter === p ? 'def-pos-tab--active' : ''}`}
                onClick={() => setPosFilter(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <Badge variant="teal">{YEAR} Live</Badge>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="live-loading-bar">
          <span className="live-loading-dot" />
          Fetching defensive leaderboard from FanGraphs…
        </div>
      )}

      {/* Summary stat cards */}
      {!isLoading && (
        <div className="stat-grid-4">
          <StatCard
            label="Best OAA"
            value={topOAA ? fmt(topOAA.oaa, 0, true) : '—'}
            sub={topOAA ? `${topOAA.name} · ${topOAA.pos}` : 'No data'}
            color="teal" accent
          />
          <StatCard
            label="Best DRS"
            value={topDRS ? fmt(topDRS.drs, 0, true) : '—'}
            sub={topDRS ? `${topDRS.name} · ${topDRS.pos}` : 'No data'}
            color="green"
          />
          {topUZR && (
            <StatCard
              label="Best UZR/150"
              value={fmt(topUZR.uzr150, 1, true)}
              sub={`${topUZR.name} · ${topUZR.pos}`}
              color="accent"
            />
          )}
          <StatCard
            label="Best Defense"
            value={topDef ? fmt(topDef.defense, 1, true) : '—'}
            sub={topDef ? `${topDef.name} · ${topDef.pos}` : 'FG composite'}
            color="purple"
          />
        </div>
      )}

      {/* Chart */}
      {!isLoading && chartData.length > 0 && (
        <Card
          title={`Top ${chartData.length} by ${METRIC_LABELS[chartMetric]}`}
          subtitle="Click a metric below to switch the chart"
        >
          {/* Metric switcher */}
          <div className="def-metric-tabs">
            {(['oaa', 'drs', 'defense'] as const).map(m => (
              <button
                key={m}
                className={`def-pos-tab ${chartMetric === m ? 'def-pos-tab--active' : ''}`}
                onClick={() => setChartMetric(m)}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#7f93a8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4d6070', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
              <Bar dataKey="value" name={METRIC_LABELS[chartMetric]} radius={[4,4,0,0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.value >= 0 ? '#00d4aa' : '#ef4444'}
                    opacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Leaderboard table + insights */}
      {!isLoading && filtered.length > 0 && (
        <div className="defense-two-col">
          <Card
            title="Defensive Leaderboard"
            subtitle={`${filtered.length} fielders · ${YEAR} season · sorted by OAA`}
          >
            <SortableTable
              onRowClick={(row: any) => navigate(`/player?mlbId=${row.mlbId}&name=${encodeURIComponent(row.name)}`)}
              columns={[
                {
                  key: 'name', label: 'Player', align: 'left', sortable: true,
                  render: (v, row: any) => (
                    <div className="table-player-cell">
                      <PlayerAvatar mlbId={row.mlbId} name={String(v)} size={28} />
                      <span className="table-player-pos">{row.pos}</span>
                      <span>{String(v)}</span>
                    </div>
                  ),
                },
                { key: 'games', label: 'G', sortable: true },
                {
                  key: 'fieldingPct', label: 'FLD%', sortable: true,
                  render: v => <span className="mono">{fmtFP(Number(v))}</span>,
                },
                { key: 'errors', label: 'E', sortable: true },
                {
                  key: 'oaa', label: 'OAA', sortable: true,
                  render: v => {
                    const n = v as number | null;
                    if (n === null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
                    return (
                      <span style={{ color: colorVal(n), fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {n > 0 ? '+' : ''}{n.toFixed(0)}
                      </span>
                    );
                  },
                },
                {
                  key: 'drs', label: 'DRS', sortable: true,
                  render: v => {
                    const n = v as number | null;
                    if (n === null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
                    return (
                      <span style={{ color: colorVal(n), fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {n > 0 ? '+' : ''}{n.toFixed(0)}
                      </span>
                    );
                  },
                },
                // UZR/150 column only shown when at least one player has a value
                ...(filtered.some(r => r.uzr150 !== null) ? [{
                  key: 'uzr150', label: 'UZR/150', sortable: true,
                  render: (v: unknown) => {
                    const n = v as number | null;
                    if (n === null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
                    return <span className="mono" style={{ color: colorVal(n) }}>{fmt(n, 1, true)}</span>;
                  },
                }] : []),
                {
                  key: 'defense', label: 'DEF', sortable: true,
                  render: v => {
                    const n = v as number | null;
                    if (n === null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
                    return <span className="mono" style={{ color: colorVal(n) }}>{fmt(n, 1, true)}</span>;
                  },
                },
                {
                  key: 'cFraming', label: 'Framing', sortable: true,
                  render: v => {
                    const n = v as number | null;
                    if (n === null) return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
                    return <span className="mono" style={{ color: '#20b2ff' }}>{fmt(n, 1, true)}</span>;
                  },
                },
              ]}
              data={filtered as any}
              rowKey="mlbId"
              defaultSort="oaa"
            />
          </Card>

          <InsightPanel insights={insights} title="Defensive Intelligence" />
        </div>
      )}

      {/* Empty state if leaderboard failed */}
      {!isLoading && filtered.length === 0 && (
        <div className="live-prompt">
          <div className="live-prompt-icon">🛡️</div>
          <p>No defensive data available yet.</p>
          <p className="live-prompt-sub">FanGraphs leaderboard may not have enough data early in the season.</p>
        </div>
      )}
    </div>
  );
}
