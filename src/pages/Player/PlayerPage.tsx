import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import ShareButton from '../../components/ui/ShareButton';
import FavoriteButton from '../../components/ui/FavoriteButton';
import { useRecentPlayers } from '../../hooks/usePlayerLists';
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import { PercentileGroup } from '../../components/ui/PercentileBar';
import InsightPanel from '../../components/ui/InsightPanel';
import Badge from '../../components/ui/Badge';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import {
  usePitchingStats,
  useHittingStats,
  usePlayer,
  useGameLog,
  usePitchArsenal,
  usePitcherGameLog,
  useDefenseStats,
  useHittingSplits,
  usePitchingSplits,
  usePitchSpinStats,
  useCareerStats,
  useStatcastSprayChart,
  useStatcastZoneData,
  useHittingPercentileRanks,
  usePitchingPercentileRanks,
  useDraftInfo,
  useSavantExpectedBatterStats,
  useSavantExpectedPitcherStats,
  useSavantCustomBatterMap,
  useSavantCustomPitcherMap,
  type HittingPercentileRanks,
  type PitchingPercentileRanks,
  type HittingSplitEntry,
  type PitchingSplitEntry,
  type HittingSplitsData,
  type PitchingSplitsData,
} from '../../hooks/useMLBData';
import type { GameLogEntry, PitcherGameLogEntry } from '../../data/api/mlbStats';
import { StatTooltip } from '../../components/ui/StatTooltip';
import { buildSprayChart, buildHeatmap, buildWobaTrend } from '../../data/api/generators';
import type { HittingStats, PitchingStats } from '../../data/types';
import '../../styles/shared.css';
// HittingPage.css merged into shared.css

// ─── Position helpers ─────────────────────────────────────────────────

const PITCHER_POS  = ['P', 'SP', 'RP', 'CL', 'TWP'];
const TWO_WAY_POS  = ['TWP'];

function resolveRoles(pos: string | undefined) {
  const p = pos ?? '';
  return {
    showPitching: PITCHER_POS.includes(p),
    showHitting:  !PITCHER_POS.includes(p) || TWO_WAY_POS.includes(p),
  };
}

// ─── Pitch colour palette ─────────────────────────────────────────────

const PITCH_COLORS: Record<string, string> = {
  FF: '#20b2ff', SI: '#00d4aa', FC: '#a855f7',
  SL: '#f59e0b', CU: '#ef4444', CH: '#22c55e',
  FS: '#fb923c', KC: '#ec4899', CS: '#8b5cf6',
  ST: '#f97316', SV: '#14b8a6',
};

const PITCH_NAMES: Record<string, string> = {
  FF: 'Four-Seam Fastball', SI: 'Sinker', FC: 'Cutter',
  SL: 'Slider', CU: 'Curveball', CH: 'Changeup',
  FS: 'Split-Finger', KC: 'Knuckle Curve', CS: 'Slow Curve',
  ST: 'Sweeper', SV: 'Slurve',
};

const SPRAY_COLORS: Record<string, string> = {
  single: '#f97316',
  double: '#20b2ff',
  triple: '#a855f7',
  hr:     '#ef4444',
};

// ─── Percentile helpers ───────────────────────────────────────────────

function clamp(v: number, lo = 1, hi = 99) { return Math.min(hi, Math.max(lo, v)); }

function buildPitchingPercentiles(stats: PitchingStats, real?: PitchingPercentileRanks | null) {
  const calc = (raw: number) => clamp(Math.round(raw));
  return [
    { label: 'K%',           value: real?.kPct      ?? calc(((stats.kPct - 15) / 15) * 100),                        raw: `${stats.kPct.toFixed(1)}%` },
    { label: 'BB%',          value: real?.bbPct      ?? calc(100 - ((stats.bbPct - 4) / 8) * 100),                   raw: `${stats.bbPct.toFixed(1)}%` },
    { label: 'ERA',          value: real?.era        ?? calc(100 - ((stats.era - 2.5) / 3) * 100),                   raw: stats.era.toFixed(2) },
    { label: 'xERA',         value: real?.xera       ?? (stats.xfip > 0 ? calc(100 - ((stats.xfip - 2.5) / 3) * 100) : 50), raw: stats.xfip > 0 ? stats.xfip.toFixed(2) : '—' },
    { label: 'FIP',          value: real?.fip        ?? (stats.fip  !== 0 ? calc(100 - ((stats.fip  - 2.5) / 3) * 100) : 50), raw: stats.fip  !== 0 ? stats.fip.toFixed(2)  : '—' },
    { label: 'GB%',          value: real?.gbPct      ?? calc(((stats.gbPct - 30) / 25) * 100),                       raw: stats.gbPct > 0 ? `${stats.gbPct.toFixed(1)}%` : '—' },
    { label: 'Avg Velocity', value: real?.velocity   ?? (stats.avgVelocity > 0 ? calc(((stats.avgVelocity - 88) / 10) * 100) : 50), raw: stats.avgVelocity > 0 ? `${stats.avgVelocity.toFixed(1)} mph` : '—' },
    { label: 'Whiff%',       value: real?.whiffPct   ?? (stats.whiffPct > 0 ? calc(((stats.whiffPct - 15) / 15) * 100) : 50),      raw: stats.whiffPct > 0 ? `${stats.whiffPct.toFixed(1)}%` : '—' },
    { label: 'Chase%',       value: real?.chasePct   ?? (stats.chasePct > 0 ? calc(((stats.chasePct - 25) / 12) * 100) : 50),      raw: stats.chasePct > 0 ? `${stats.chasePct.toFixed(1)}%` : '—' },
  ];
}

function buildHittingPercentiles(stats: HittingStats, real?: HittingPercentileRanks | null, oaaRaw?: number | null) {
  const calc = (v: number) => clamp(Math.round(v));
  const rows = [
    { label: 'wRC+',          value: real?.wrcPlus    ?? calc(50 + (stats.wrcPlus - 100) / 60 * 50),                              raw: stats.wrcPlus > 0 ? stats.wrcPlus.toString() : '—' },
    { label: 'Exit Velocity', value: real?.exitVelo   ?? (stats.exitVelo > 0 ? calc(50 + (stats.exitVelo - 88.5) / 7 * 50) : 50),  raw: stats.exitVelo > 0 ? `${stats.exitVelo.toFixed(1)} mph` : '—' },
    { label: 'Barrel %',      value: real?.barrelPct  ?? (stats.barrelPct > 0 ? calc(50 + (stats.barrelPct - 7.5) / 12 * 50) : 1), raw: stats.barrelPct > 0 ? `${stats.barrelPct.toFixed(1)}%` : '—' },
    { label: 'Hard Hit %',    value: real?.hardHitPct ?? (stats.hardHitPct > 0 ? calc(50 + (stats.hardHitPct - 37) / 20 * 50) : 1),raw: stats.hardHitPct > 0 ? `${stats.hardHitPct.toFixed(1)}%` : '—' },
    { label: 'wOBA',          value: real?.woba       ?? (stats.woba > 0 ? calc(50 + (stats.woba - 0.320) / 0.080 * 50) : 50),   raw: stats.woba > 0 ? stats.woba.toFixed(3) : '—' },
    { label: 'BB%',           value: real?.bbPct      ?? calc(50 + (stats.bbPct - 8.5) / 8 * 50),                                 raw: `${stats.bbPct.toFixed(1)}%` },
    { label: 'K%',            value: real?.kPct       ?? calc(50 + (22 - stats.kPct) / 12 * 50),                                  raw: `${stats.kPct.toFixed(1)}%` },
  ];
  // Sprint Speed — only show when we have a real value (not all players tracked)
  if (real?.sprintSpeed != null || (stats.sprint > 0)) {
    rows.push({
      label: 'Sprint Speed',
      value: real?.sprintSpeed ?? calc(50 + (stats.sprint - 27) / 4 * 50),
      raw:   stats.sprint > 0 ? `${stats.sprint.toFixed(1)} ft/s` : '—',
    });
  }
  // OAA — only show when we have a real percentile (position players with ≥200 Inn)
  if (real?.oaa != null) {
    const oaaDisplay = oaaRaw != null
      ? (oaaRaw >= 0 ? `+${oaaRaw.toFixed(0)}` : oaaRaw.toFixed(0))
      : '—';
    rows.push({ label: 'OAA', value: real.oaa, raw: oaaDisplay });
  }
  return rows;
}

function buildPitchingRadar(stats: PitchingStats, real?: PitchingPercentileRanks | null) {
  const calc = (v: number) => clamp(Math.round(v), 0, 100);
  return [
    { subject: 'K%',       value: real?.kPct      ?? calc(((stats.kPct - 15) / 15) * 100) },
    { subject: 'Control',  value: real?.bbPct      ?? calc(100 - ((stats.bbPct - 4) / 8) * 100) },
    { subject: 'GB%',      value: real?.gbPct      ?? calc(((stats.gbPct - 30) / 25) * 100) },
    { subject: 'Velocity', value: real?.velocity   ?? (stats.avgVelocity > 0 ? calc(((stats.avgVelocity - 88) / 10) * 100) : 50) },
    { subject: 'Whiff%',   value: real?.whiffPct   ?? (stats.whiffPct > 0 ? calc(((stats.whiffPct - 15) / 15) * 100) : 50) },
    { subject: 'Chase%',   value: real?.chasePct   ?? (stats.chasePct > 0 ? calc(((stats.chasePct - 25) / 12) * 100) : 50) },
  ];
}

function buildPitchingInsights(stats: PitchingStats, hasArsenal: boolean) {
  const out: Array<{ type: 'info' | 'positive' | 'warning' | 'tip'; text: string }> = [];
  out.push({ type: 'info', text: 'Live data from MLB Stats API + Baseball Savant Statcast.' });
  if (stats.kPct > 28)    out.push({ type: 'positive', text: `Elite strikeout rate (${stats.kPct.toFixed(1)}%) — top-tier swing-and-miss profile.` });
  if (stats.era < stats.xfip && stats.xfip > 0) out.push({ type: 'info', text: `ERA (${stats.era.toFixed(2)}) outpacing xERA (${stats.xfip.toFixed(2)}) — potential regression risk.` });
  else if (stats.xfip > 0) out.push({ type: 'positive', text: `xERA (${stats.xfip.toFixed(2)}) below ERA (${stats.era.toFixed(2)}) — ERA improvement expected.` });
  if (stats.bbPct > 10)   out.push({ type: 'warning', text: `Walk rate (${stats.bbPct.toFixed(1)}%) elevated — command issues limiting effectiveness.` });
  if (stats.whiffPct > 27) out.push({ type: 'positive', text: `Above-average whiff rate (${stats.whiffPct.toFixed(1)}%) — elite swing-and-miss.` });
  if (stats.chasePct > 32) out.push({ type: 'positive', text: `Elite chase rate (${stats.chasePct.toFixed(1)}%) — gets hitters to expand the zone.` });
  if (stats.avgVelocity > 96) out.push({ type: 'positive', text: `Premium fastball velocity (${stats.avgVelocity.toFixed(1)} mph).` });
  if (!hasArsenal) out.push({ type: 'tip', text: 'Pitch arsenal populates once enough appearances are logged this season.' });
  return out;
}

function buildHittingInsights(stats: HittingStats) {
  const ins: Array<{ type: 'info' | 'positive' | 'warning' | 'tip'; text: string }> = [];
  if (stats.wrcPlus >= 140) ins.push({ type: 'positive', text: `Elite wRC+ of ${stats.wrcPlus} — among the top offensive players in the league.` });
  if (stats.barrelPct >= 12) ins.push({ type: 'positive', text: `Barrel rate (${stats.barrelPct.toFixed(1)}%) is elite — hard contact drives above-average power.` });
  if (stats.bbPct > 10)     ins.push({ type: 'tip',      text: `Excellent plate discipline (BB% ${stats.bbPct.toFixed(1)}%) — forces favorable counts.` });
  if (stats.obp - stats.avg > 0.08) ins.push({ type: 'info', text: `High OBP–AVG gap (${(stats.obp - stats.avg).toFixed(3)}) reflects excellent walk discipline.` });
  if (stats.exitVelo > 92)  ins.push({ type: 'positive', text: `Above-average exit velocity (${stats.exitVelo.toFixed(1)} mph) — consistently squares up pitches.` });
  return ins;
}

// ─── Tooltips ─────────────────────────────────────────────────────────

const PitchTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">Appearance #{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const HitTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="chart-tooltip-row">
          <span style={{ color: p.color }}>{p.name}:</span>
          <strong>{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Section divider ──────────────────────────────────────────────────

function SectionDivider({ title, color = 'var(--color-accent)' }: { title: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 0', marginTop: 8,
    }}>
      <div style={{ width: 4, height: 24, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="stat-grid-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="stat-card skeleton-card">
          <div className="skeleton-line skeleton-label" />
          <div className="skeleton-line skeleton-value" />
          <div className="skeleton-line skeleton-sub" />
        </div>
      ))}
    </div>
  );
}

// ─── Game Log Tables ──────────────────────────────────────────────────

function HitterGameLogTable({ log }: { log: GameLogEntry[] }) {
  // log arrives in chronological order (oldest first) — compute running season totals
  let cumH = 0, cumAB = 0;
  const withCumAvg = log.map(g => {
    cumH  += g.hits;
    cumAB += g.atBats;
    const seasonAvg = cumAB > 0 ? cumH / cumAB : null;
    return { ...g, seasonAvg };
  });

  // Display newest first
  const rows = [...withCumAvg].reverse().slice(0, 40);

  return (
    <div className="game-log-wrap">
      <table className="game-log-table">
        <thead>
          <tr>
            <th>Date</th><th>Opp</th>
            <th>AB</th><th>H</th><th>2B</th><th>3B</th>
            <th>HR</th><th>RBI</th><th>R</th>
            <th><StatTooltip stat="BB%"><span className="stat-tt-trigger">BB</span></StatTooltip></th>
            <th><StatTooltip stat="K%"><span className="stat-tt-trigger">K</span></StatTooltip></th>
            <th>SB</th>
            <th><StatTooltip stat="Season AVG" position="top"><span className="stat-tt-trigger">Season AVG</span></StatTooltip></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => {
            const avgStr    = g.seasonAvg !== null ? g.seasonAvg.toFixed(3).replace('0.', '.') : '—';
            const isHotAvg  = g.seasonAvg !== null && g.seasonAvg >= 0.300;
            const isColdAvg = g.seasonAvg !== null && g.seasonAvg < 0.230;
            return (
              <tr key={i}>
                <td className="gl-date">{g.date ? g.date.slice(5) : '—'}</td>
                <td className="gl-opp">
                  <span className="gl-at">{g.isHome ? 'vs' : '@'}</span>
                  {g.opponent || '—'}
                </td>
                <td>{g.atBats}</td>
                <td className={g.hits > 0 ? 'gl-hit' : ''}>{g.hits}</td>
                <td>{g.doubles  || '—'}</td>
                <td>{g.triples  || '—'}</td>
                <td className={g.homeRuns > 0 ? 'gl-hr' : ''}>{g.homeRuns || '—'}</td>
                <td>{g.rbi       ?? '—'}</td>
                <td>{g.runs      ?? '—'}</td>
                <td>{g.walks}</td>
                <td>{g.strikeouts}</td>
                <td>{g.stolenBases || '—'}</td>
                <td className={isHotAvg ? 'gl-avg-hi' : isColdAvg ? 'gl-avg-lo' : ''}>{avgStr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PitcherGameLogTable({ log }: { log: PitcherGameLogEntry[] }) {
  const rows = [...log].reverse().slice(0, 40);
  return (
    <div className="game-log-wrap">
      <table className="game-log-table">
        <thead>
          <tr>
            <th>Date</th><th>Opp</th>
            <th><StatTooltip stat="Dec" position="top"><span className="stat-tt-trigger">Dec</span></StatTooltip></th>
            <th><StatTooltip stat="IP"  position="top"><span className="stat-tt-trigger">IP</span></StatTooltip></th>
            <th>H</th><th>ER</th>
            <th><StatTooltip stat="BB%" position="top"><span className="stat-tt-trigger">BB</span></StatTooltip></th>
            <th><StatTooltip stat="K%"  position="top"><span className="stat-tt-trigger">K</span></StatTooltip></th>
            <th>HR</th>
            <th><StatTooltip stat="PC"  position="top"><span className="stat-tt-trigger">PC</span></StatTooltip></th>
            <th><StatTooltip stat="K/9" position="top"><span className="stat-tt-trigger">K/9</span></StatTooltip></th>
            <th><StatTooltip stat="ERA" position="top"><span className="stat-tt-trigger">ERA</span></StatTooltip></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => {
            const isQS = g.ip >= 6 && g.er <= 3;
            const dec  = g.w > 0 ? 'W' : g.l > 0 ? 'L' : g.sv > 0 ? 'S' : '—';
            const decCls = g.w > 0 ? 'gl-dec-w' : g.l > 0 ? 'gl-dec-l' : g.sv > 0 ? 'gl-dec-s' : '';
            const ipStr = Number.isInteger(g.ip) ? `${g.ip}.0` : g.ip.toFixed(1).replace(/\.(\d)$/, '.$1');
            return (
              <tr key={i} className={isQS ? 'gl-qs' : ''}>
                <td className="gl-date">{g.date ? g.date.slice(5) : '—'}</td>
                <td className="gl-opp">
                  <span className="gl-at">{g.isHome ? 'vs' : '@'}</span>
                  {g.opponent || '—'}
                </td>
                <td className={decCls}>{dec}</td>
                <td>{ipStr}</td>
                <td>{g.h}</td>
                <td className={g.er > 4 ? 'gl-hr' : g.er === 0 ? 'gl-hit' : ''}>{g.er}</td>
                <td>{g.bb}</td>
                <td className={g.k >= 8 ? 'gl-hit' : ''}>{g.k}</td>
                <td>{g.hr || '—'}</td>
                <td className="gl-avg-lo">{g.pc > 0 ? g.pc : '—'}</td>
                <td>{g.ip > 0 ? g.k9.toFixed(1) : '—'}</td>
                <td className={g.er === 0 ? 'gl-dec-w' : g.era > 7 ? 'gl-dec-l' : ''}>
                  {g.ip > 0 ? g.era.toFixed(2) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Splits cards ─────────────────────────────────────────────────────

// Map split card labels to glossary keys
const SPLIT_HIT_SLASH  = [
  { label: 'AVG', gloss: 'AVG' },
  { label: 'OBP', gloss: 'OBP' },
  { label: 'SLG', gloss: 'SLG' },
] as const;

const SPLIT_HIT_SUB = [
  { label: 'HR',  gloss: null },
  { label: 'RBI', gloss: null },
  { label: 'BB%', gloss: 'BB%' },
  { label: 'K%',  gloss: 'K%' },
  { label: 'SB',  gloss: null },
  { label: 'OPS', gloss: 'OPS' },
] as const;

const SPLIT_PIT_SLASH = [
  { label: 'AVG', gloss: 'AVG' },
  { label: 'OBP', gloss: 'OBP' },
  { label: 'K/9', gloss: 'K/9' },
] as const;

const SPLIT_PIT_SUB = [
  { label: 'ERA',  gloss: 'ERA' },
  { label: 'BB/9', gloss: 'BB/9' },
  { label: 'HR',   gloss: null },
  { label: 'K%',   gloss: 'K%' },
  { label: 'BB%',  gloss: 'BB%' },
  { label: 'IP',   gloss: 'IP' },
] as const;

function SplitLabel({ label, gloss }: { label: string; gloss: string | null }) {
  if (!gloss) return <span className="split-slash-label">{label}</span>;
  return (
    <StatTooltip stat={gloss} position="bottom">
      <span className="split-slash-label stat-tt-trigger">{label}</span>
    </StatTooltip>
  );
}

function SplitStatCard({ entry, color }: { entry: HittingSplitEntry; color: string }) {
  const slashValues = [
    entry.avg.replace('0.', '.'),
    entry.obp.replace('0.', '.'),
    entry.slg.replace('0.', '.'),
  ];
  const subValues = [
    String(entry.hr),
    String(entry.rbi),
    entry.pa > 0 ? (entry.bb / entry.pa * 100).toFixed(1) + '%' : '—',
    entry.pa > 0 ? (entry.k  / entry.pa * 100).toFixed(1) + '%' : '—',
    String(entry.sb),
    entry.ops.replace('0.', '.'),
  ];

  return (
    <div className="split-card">
      <div className="split-card-header">
        <span className="split-card-title" style={{ color }}>{entry.label}</span>
        <span className="split-pa">{entry.pa} PA</span>
      </div>
      <div className="split-slash">
        {SPLIT_HIT_SLASH.map((s, i) => (
          <div key={s.label} className="split-slash-stat">
            <span className="split-slash-value">{slashValues[i]}</span>
            <SplitLabel label={s.label} gloss={s.gloss} />
          </div>
        ))}
      </div>
      <div className="split-sub-stats">
        {SPLIT_HIT_SUB.map((s, i) => (
          <div key={s.label} className="split-sub-stat">
            <span className="split-sub-value">{subValues[i]}</span>
            <SplitLabel label={s.label} gloss={s.gloss} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PitchSplitCard({ entry, color }: { entry: PitchingSplitEntry; color: string }) {
  const slashValues = [
    entry.avg.replace(/^0\./, '.'),
    entry.obp.replace(/^0\./, '.'),
    entry.k9.toFixed(1),
  ];
  const subValues = [
    entry.era.toFixed(2),
    entry.bb9.toFixed(1),
    String(entry.hr),
    entry.bf > 0 ? (entry.k  / entry.bf * 100).toFixed(1) + '%' : '—',
    entry.bf > 0 ? (entry.bb / entry.bf * 100).toFixed(1) + '%' : '—',
    entry.ip.toFixed(1),
  ];

  return (
    <div className="split-card">
      <div className="split-card-header">
        <span className="split-card-title" style={{ color }}>{entry.label}</span>
        <span className="split-pa">{entry.bf} BF</span>
      </div>
      <div className="split-slash">
        {SPLIT_PIT_SLASH.map((s, i) => (
          <div key={s.label} className="split-slash-stat">
            <span className="split-slash-value">{slashValues[i]}</span>
            <SplitLabel label={s.label} gloss={s.gloss} />
          </div>
        ))}
      </div>
      <div className="split-sub-stats">
        {SPLIT_PIT_SUB.map((s, i) => (
          <div key={s.label} className="split-sub-stat">
            <span className="split-sub-value">{subValues[i]}</span>
            <SplitLabel label={s.label} gloss={s.gloss} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Splits group label ───────────────────────────────────────────────

function SplitGroupLabel({ title }: { title: string }) {
  return (
    <div className="split-group-label">{title}</div>
  );
}

function SplitsHitting({ splits }: { splits: HittingSplitsData | null | undefined }) {
  if (!splits) return <div className="split-no-data">No split data available for this season yet.</div>;

  const hasAny = Object.values(splits).some(v => v !== null);
  if (!hasAny) return <div className="split-no-data">No split data available for this season yet.</div>;

  const GROUPS: Array<{ title: string; entries: Array<{ entry: HittingSplitEntry | null; color: string }> }> = [
    {
      title: 'vs. Handedness',
      entries: [
        { entry: splits.vsLeft,  color: 'var(--color-accent)' },
        { entry: splits.vsRight, color: 'var(--color-green)'  },
      ],
    },
    {
      title: 'Home / Away',
      entries: [
        { entry: splits.home, color: 'var(--color-teal)'   },
        { entry: splits.away, color: 'var(--color-purple)' },
      ],
    },
    {
      title: 'Recent',
      entries: [
        { entry: splits.last7,  color: 'var(--color-amber)' },
        { entry: splits.last30, color: 'var(--color-amber)' },
      ],
    },
    {
      title: 'Day / Night',
      entries: [
        { entry: splits.day,   color: 'var(--color-amber)' },
        { entry: splits.night, color: 'var(--color-accent)' },
      ],
    },
  ];

  return (
    <>
      {GROUPS.map(g => {
        const visEntries = g.entries.filter(e => e.entry !== null);
        if (!visEntries.length) return null;
        return (
          <div key={g.title} className="split-section">
            <SplitGroupLabel title={g.title} />
            <div className="splits-grid">
              {visEntries.map(({ entry, color }) =>
                entry ? <SplitStatCard key={entry.split + entry.label} entry={entry} color={color} /> : null
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function SplitsPitching({ splits }: { splits: PitchingSplitsData | null | undefined }) {
  if (!splits) return <div className="split-no-data">No split data available for this season yet.</div>;

  const hasAny = Object.values(splits).some(v => v !== null);
  if (!hasAny) return <div className="split-no-data">No split data available for this season yet.</div>;

  const GROUPS: Array<{ title: string; entries: Array<{ entry: PitchingSplitEntry | null; color: string }> }> = [
    {
      title: 'vs. Handedness',
      entries: [
        { entry: splits.vsLeft,  color: 'var(--color-accent)' },
        { entry: splits.vsRight, color: 'var(--color-amber)'  },
      ],
    },
    {
      title: 'Home / Away',
      entries: [
        { entry: splits.home, color: 'var(--color-teal)'   },
        { entry: splits.away, color: 'var(--color-purple)' },
      ],
    },
    {
      title: 'Recent',
      entries: [
        { entry: splits.last7,  color: 'var(--color-green)' },
        { entry: splits.last30, color: 'var(--color-green)' },
      ],
    },
    {
      title: 'Day / Night',
      entries: [
        { entry: splits.day,   color: 'var(--color-amber)' },
        { entry: splits.night, color: 'var(--color-accent)' },
      ],
    },
  ];

  return (
    <>
      {GROUPS.map(g => {
        const visEntries = g.entries.filter(e => e.entry !== null);
        if (!visEntries.length) return null;
        return (
          <div key={g.title} className="split-section">
            <SplitGroupLabel title={g.title} />
            <div className="splits-grid">
              {visEntries.map(({ entry, color }) =>
                entry ? <PitchSplitCard key={entry.split + entry.label} entry={entry} color={color} /> : null
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ─── Player Info Tab ──────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '10px 0', borderBottom: '1px solid var(--color-border)',
      gap: 16,
    }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--color-text-primary)', fontWeight: 500, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ width: 32, height: 2, background: 'var(--color-accent)', borderRadius: 2, marginBottom: 12 }} />
      {children}
    </div>
  );
}

function handLabel(code: string, type: 'bat' | 'throw') {
  if (code === 'S') return 'Switch';
  if (code === 'R') return type === 'bat' ? 'Right' : 'Right';
  if (code === 'L') return 'Left';
  return code;
}

function fmtDate(iso: string) {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtBirthLocation(city?: string, state?: string, country?: string) {
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function PlayerInfoTab({ person, draftInfo }: {
  person: import('../../data/types').Player | null;
  draftInfo: import('../../data/api/mlbStats').RawDraftInfo | null;
}) {
  if (!person) return (
    <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '24px 0' }}>
      Player info not available.
    </p>
  );

  const birthLocation = fmtBirthLocation(person.birthCity, person.birthStateProvince, person.nationality);
  const batsLabel = handLabel(person.bats, 'bat') + (person.bats === 'S' ? ' Hitter' : '');
  const throwsLabel = handLabel(person.throws, 'throw');

  const draftLine = draftInfo?.draftYear ? [
    `${draftInfo.draftYear} MLB Draft`,
    draftInfo.round     ? `Round ${draftInfo.round}`           : null,
    draftInfo.pickNumber != null ? `Pick ${draftInfo.pickNumber}` : null,
  ].filter(Boolean).join(' · ') : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 8 }}>

      {/* Personal */}
      <InfoSection title="Personal">
        <InfoRow label="Full Name"   value={person.name} />
        {person.nickName && <InfoRow label="Nickname" value={`"${person.nickName}"`} />}
        <InfoRow label="Date of Birth" value={fmtDate(person.birthdate)} />
        <InfoRow label="Age"          value={person.age > 0 ? person.age : null} />
        <InfoRow label="Birthplace"   value={birthLocation} />
        <InfoRow label="Height"       value={person.height || null} />
        <InfoRow label="Weight"       value={person.weight > 0 ? `${person.weight} lbs` : null} />
      </InfoSection>

      {/* Playing Info */}
      <InfoSection title="Playing Info">
        <InfoRow label="Position"     value={person.positionName || null} />
        <InfoRow label="Jersey #"     value={person.jersey > 0 ? `#${person.jersey}` : null} />
        <InfoRow label="Bats"         value={batsLabel} />
        <InfoRow label="Throws"       value={throwsLabel} />
        <InfoRow label="Team"         value={person.isFreeAgent ? 'Free Agent' : (person.teamName || null)} />
        <InfoRow label="MLB Debut"    value={fmtDate(person.mlbDebutDate ?? '')} />
      </InfoSection>

      {/* Draft */}
      {(draftInfo?.draftYear || draftInfo?.school?.name) && (
        <InfoSection title="Draft">
          <InfoRow label="Draft"        value={draftLine} />
          {draftInfo.draftTeam?.name && (
            <InfoRow label="Drafted By" value={draftInfo.draftTeam.name} />
          )}
          {draftInfo.school?.name && (
            <InfoRow label="School"     value={[
              draftInfo.school.name,
              draftInfo.school.state ?? draftInfo.school.country,
            ].filter(Boolean).join(', ')} />
          )}
        </InfoSection>
      )}

    </div>
  );
}

// ─── Career Stats Tab ─────────────────────────────────────────────────

import type {
  CareerHittingSeason, CareerPitchingSeason,
  CareerHittingTotals, CareerPitchingTotals,
} from '../../data/api/mlbStats';

// WAR isn't returned by the stats=career endpoint so we still sum it from seasons.
// Multi-team seasons have a combined "N Teams" row — use that to avoid double-counting.
function careerWAR<T extends { season: string; teamAbbr: string; war: number }>(rows: T[]): number {
  const seen = new Set<string>();
  let total = 0;
  for (const r of rows) {
    // If a combined row exists for this season, only count it once
    if (r.teamAbbr.endsWith('Teams')) {
      total += r.war;
      seen.add(r.season);
    } else if (!seen.has(r.season)) {
      total += r.war;
    }
  }
  return total;
}

function CareerStatsTab({
  hitting, pitching, hittingTotals, pitchingTotals, isLoading, showHitting, showPitching,
}: {
  hitting: CareerHittingSeason[];
  pitching: CareerPitchingSeason[];
  hittingTotals: CareerHittingTotals | null;
  pitchingTotals: CareerPitchingTotals | null;
  isLoading: boolean;
  showHitting: boolean;
  showPitching: boolean;
}) {
  if (isLoading) return <StatSkeleton />;

  const hitWAR = careerWAR(hitting);
  const pitWAR = careerWAR(pitching);

  const careerRowStyle: React.CSSProperties = {
    borderTop: '2px solid var(--color-border)',
    background: 'color-mix(in srgb, var(--color-surface) 60%, var(--color-bg))',
    fontWeight: 700,
  };

  return (
    <>
      {showPitching && pitching.length > 0 && (
        <>
          <SectionDivider title="Pitching — Year by Year" color="var(--color-accent)" />
          <div className="career-table-wrap">
            <table className="career-table">
              <thead>
                <tr>
                  <th>Year</th><th>Team</th><th>G</th><th>GS</th>
                  <th>W</th><th>L</th><th>SV</th><th>IP</th>
                  <th>ERA</th><th>WHIP</th><th>K/9</th><th>BB/9</th>
                  <th>K</th><th>BB</th><th>HR</th><th>WAR</th>
                </tr>
              </thead>
              <tbody>
                {[...pitching].reverse().map((s, i) => (
                  <tr key={i}>
                    <td className="career-td-season">{s.season}</td>
                    <td className="career-td-team">{s.teamAbbr}</td>
                    <td>{s.g}</td><td>{s.gs}</td>
                    <td>{s.w}</td><td>{s.l}</td><td>{s.sv}</td>
                    <td>{s.ip.toFixed(1)}</td>
                    <td>{s.era.toFixed(2)}</td>
                    <td>{s.whip.toFixed(2)}</td>
                    <td>{s.k9.toFixed(1)}</td>
                    <td>{s.bb9.toFixed(1)}</td>
                    <td>{s.k}</td><td>{s.bb}</td><td>{s.hr}</td>
                    <td className="career-td-key">{s.war !== 0 ? s.war.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {pitchingTotals && (
                <tfoot>
                  <tr style={careerRowStyle}>
                    <td className="career-td-season" style={{ color: 'var(--color-text-primary)' }}>Career</td>
                    <td className="career-td-team" style={{ color: 'var(--color-text-secondary)' }}>MLB</td>
                    <td>{pitchingTotals.g}</td><td>{pitchingTotals.gs}</td>
                    <td>{pitchingTotals.w}</td><td>{pitchingTotals.l}</td><td>{pitchingTotals.sv}</td>
                    <td>{pitchingTotals.ip.toFixed(1)}</td>
                    <td>{pitchingTotals.era.toFixed(2)}</td>
                    <td>{pitchingTotals.whip.toFixed(2)}</td>
                    <td>{pitchingTotals.k9.toFixed(1)}</td>
                    <td>{pitchingTotals.bb9.toFixed(1)}</td>
                    <td>{pitchingTotals.k}</td><td>{pitchingTotals.bb}</td><td>{pitchingTotals.hr}</td>
                    <td className="career-td-key" style={{ color: 'var(--color-accent)' }}>
                      {pitWAR !== 0 ? pitWAR.toFixed(1) : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {showHitting && hitting.length > 0 && (
        <>
          <SectionDivider title="Hitting — Year by Year" color="var(--color-green)" />
          <div className="career-table-wrap">
            <table className="career-table">
              <thead>
                <tr>
                  <th>Year</th><th>Team</th><th>G</th><th>PA</th>
                  <th>H</th><th>2B</th><th>3B</th><th>HR</th>
                  <th>RBI</th><th>R</th><th>SB</th>
                  <th>AVG</th><th>OBP</th><th>SLG</th><th>OPS</th><th>WAR</th>
                </tr>
              </thead>
              <tbody>
                {[...hitting].reverse().map((s, i) => (
                  <tr key={i}>
                    <td className="career-td-season">{s.season}</td>
                    <td className="career-td-team">{s.teamAbbr}</td>
                    <td>{s.g}</td><td>{s.pa}</td>
                    <td>{s.h}</td><td>{s.doubles}</td><td>{s.triples}</td><td>{s.hr}</td>
                    <td>{s.rbi}</td><td>{s.r}</td><td>{s.sb}</td>
                    <td>{s.avg.toFixed(3)}</td>
                    <td>{s.obp.toFixed(3)}</td>
                    <td>{s.slg.toFixed(3)}</td>
                    <td>{s.ops.toFixed(3)}</td>
                    <td className="career-td-key">{s.war !== 0 ? s.war.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              {hittingTotals && (
                <tfoot>
                  <tr style={careerRowStyle}>
                    <td className="career-td-season" style={{ color: 'var(--color-text-primary)' }}>Career</td>
                    <td className="career-td-team" style={{ color: 'var(--color-text-secondary)' }}>MLB</td>
                    <td>{hittingTotals.g}</td><td>{hittingTotals.pa}</td>
                    <td>{hittingTotals.h}</td><td>{hittingTotals.doubles}</td><td>{hittingTotals.triples}</td><td>{hittingTotals.hr}</td>
                    <td>{hittingTotals.rbi}</td><td>{hittingTotals.r}</td><td>{hittingTotals.sb}</td>
                    <td>{hittingTotals.avg.toFixed(3)}</td>
                    <td>{hittingTotals.obp.toFixed(3)}</td>
                    <td>{hittingTotals.slg.toFixed(3)}</td>
                    <td>{hittingTotals.ops.toFixed(3)}</td>
                    <td className="career-td-key" style={{ color: 'var(--color-green)' }}>
                      {hitWAR !== 0 ? hitWAR.toFixed(1) : '—'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {!showPitching && !showHitting && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '24px 0' }}>
          No career data available.
        </p>
      )}
    </>
  );
}

// ─── Stats Hub tooltip map ────────────────────────────────────────────
// Maps the short display labels used in the Stats Hub grid → STAT_GLOSSARY keys

const ALLSTATS_TT: Record<string, string> = {
  // Counting — standard
  'G': 'G', 'GS': 'GS', 'PA': 'PA', 'AB': 'AB',
  'H': 'H', '1B': '1B', '2B': '2B', '3B': '3B',
  'HR': 'HR', 'R': 'R', 'RBI': 'RBI', 'SB': 'SB',
  'BB': 'BB', 'SO': 'SO',
  'W': 'W', 'L': 'L', 'SV': 'SV', 'IP': 'IP',
  // Slash / rate
  'AVG': 'AVG', 'OBP': 'OBP', 'SLG': 'SLG', 'OPS': 'OPS',
  'wOBA': 'wOBA', 'wRC+': 'wRC+', 'ISO': 'ISO', 'BABIP': 'BABIP',
  'BB%': 'BB%', 'K%': 'K%', 'BB/K': 'BB/K',
  'LOB%': 'LOB%', 'HR/FB': 'HR/FB',
  // Statcast contact
  'Exit Velo': 'Exit Velo', 'Launch Ang': 'Launch Angle',
  'Barrel%': 'Barrel %', 'Hard Hit%': 'Hard Hit %', 'Sweet Spot%': 'Sweet Spot%',
  'Sprint': 'Sprint Speed',
  // Batted ball
  'GB%': 'GB%', 'FB%': 'FB%', 'LD%': 'LD%',
  'Pull%': 'Pull%', 'Cent%': 'Center%', 'Oppo%': 'Oppo%',
  // Statcast xStats
  'xBA': 'xBA', 'xSLG': 'xSLG', 'xwOBA': 'xwOBA', 'xISO': 'xISO',
  'BA−xBA': 'BA−xBA', 'SLG−xSLG': 'SLG−xSLG', 'wOBA−xwOBA': 'wOBA−xwOBA',
  // Pitching rate
  'ERA': 'ERA', 'FIP': 'FIP', 'xFIP': 'xERA', 'WHIP': 'WHIP',
  'K-BB%': 'K-BB%', 'K/9': 'K/9', 'BB/9': 'BB/9', 'HR/9': 'HR/9',
  'Whiff%': 'Whiff%', 'Chase%': 'Chase%',
  'Avg Velo': 'Avg Velo',
  // Value
  'WAR': 'fWAR', 'WPA': 'WPA', 'RE24': 'RE24', 'Clutch': 'Clutch',
  // Defense
  'Inn': 'Inn', 'E': 'E', 'A': 'A', 'PO': 'PO',
  'OAA': 'OAA', 'DRS': 'DRS', 'UZR': 'UZR', 'UZR/150': 'UZR/150',
  'ARM': 'ARM', 'FLD%': 'FLD%', 'Framing': 'Framing',
};

// Renders a single Stats Hub stat cell with tooltip on the label when available
function ACell({ l, v, c, note }: { l: string; v: string; c?: string; note?: string }) {
  const ttKey = ALLSTATS_TT[l];
  return (
    <div className="allstats-cell">
      {ttKey ? (
        <StatTooltip stat={ttKey}>
          <span className="allstats-label allstats-label--tip">{l}</span>
        </StatTooltip>
      ) : (
        <span className="allstats-label">{l}</span>
      )}
      <span className="allstats-value" style={{ color: c }}>{v}</span>
      {note && <span className="allstats-note">{note}</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const mlbId     = searchParams.get('mlbId') ? parseInt(searchParams.get('mlbId')!, 10) : null;
  const playerName = searchParams.get('name') ?? '';
  const [tab, setTab]           = useState<'overview' | 'stats' | 'gamelog' | 'splits' | 'career' | 'info'>('overview');
  const [twoWayRole, setTwoWayRole] = useState<'hitting' | 'pitching'>('hitting');

  // Reset tab + role when player changes
  React.useEffect(() => { setTab('overview'); setTwoWayRole('hitting'); }, [mlbId]);

  const { player: person }                              = usePlayer(mlbId);
  const { addRecent }                                   = useRecentPlayers();

  // Track this player as recently viewed once their bio loads
  React.useEffect(() => {
    if (mlbId && playerName && person) {
      addRecent({
        id: mlbId,
        name: playerName,
        teamAbbr: person.teamAbbr,
        position: person.position,
      });
    }
  }, [mlbId, playerName, person, addRecent]);

  const { stats: pitching, isLoading: pitchLoading }    = usePitchingStats(mlbId);
  const { stats: hitting,  isLoading: hitLoading }      = useHittingStats(mlbId);
  const { data: gameLog = [] }                          = useGameLog(mlbId);
  const { data: arsenal = [] }                          = usePitchArsenal(mlbId);
  const { data: pitcherLog = [] }                       = usePitcherGameLog(mlbId);
  const { data: defense }                               = useDefenseStats(mlbId);
  const { data: hittingSplits }                         = useHittingSplits(mlbId);
  const { data: pitchingSplits }                        = usePitchingSplits(mlbId);
  const pitchSpin                                       = usePitchSpinStats(mlbId);
  const { hitting: careerHitting, pitching: careerPitching, hittingTotals: careerHitTotals, pitchingTotals: careerPitTotals, isLoading: careerLoading } = useCareerStats(mlbId);
  const { data: statcastSpray, isLoading: sprayLoading } = useStatcastSprayChart(mlbId);
  const { data: zoneData }      = useStatcastZoneData(mlbId);
  const { data: hitRanks }      = useHittingPercentileRanks(mlbId);
  const { data: pitchRanks }    = usePitchingPercentileRanks(mlbId);
  const { draftInfo }           = useDraftInfo(mlbId);

  // Savant expected / custom maps
  const { data: xBatMap }  = useSavantExpectedBatterStats();
  const { data: xPitMap }  = useSavantExpectedPitcherStats();
  const { data: scBatMap } = useSavantCustomBatterMap();
  const { data: scPitMap } = useSavantCustomPitcherMap();
  const xBat  = mlbId ? (xBatMap?.get(mlbId)  ?? null) : null;
  const xPit  = mlbId ? (xPitMap?.get(mlbId)  ?? null) : null;
  const scBat = mlbId ? (scBatMap?.get(mlbId) ?? null) : null;
  const scPit = mlbId ? (scPitMap?.get(mlbId) ?? null) : null;
  const scNum = (row: Record<string,string>|null, col: string): string => {
    if (!row) return '—';
    const v = row[col]; if (!v || v.trim() === '') return '—';
    const n = parseFloat(v); return isNaN(n) ? '—' : n.toFixed(1);
  };

  // Update document title — person is now initialized above
  const resolvedName = person?.name ?? playerName;
  React.useEffect(() => {
    if (resolvedName) {
      document.title = `${resolvedName} · The Dugout`;
    } else {
      document.title = 'The Dugout · MLB Analytics';
    }
    return () => { document.title = 'The Dugout · MLB Analytics'; };
  }, [resolvedName]);

  const rawPosition = person?.position ?? '';
  // The MLB person API returns 'P' for all pitchers regardless of role.
  // Derive SP vs RP from the ratio of starts to total appearances:
  // >= 50% starts = SP (true rotation starter), otherwise RP.
  // This correctly handles openers who start 1-2 games but are relievers by role.
  const position: string = (() => {
    if (rawPosition !== 'P') return rawPosition;
    if (!pitching || pitching.games === 0) return 'P';
    return pitching.gamesStarted / pitching.games >= 0.5 ? 'SP' : 'RP';
  })();
  const { showPitching, showHitting } = resolveRoles(rawPosition);

  // Once person loads, decide which sections to show based on actual data presence too.
  // Use plateAppearances (not games) for hasHitting — pitchers have games > 0 since
  // the universal DH era but 0 PA, and we don't want them flagged as two-way.
  const hasPitching = showPitching || (pitching !== null && pitching !== undefined && pitching.games > 0);
  const hasHitting  = showHitting  || (hitting  !== null && hitting  !== undefined && (hitting.plateAppearances ?? 0) > 0);

  // Two-way players (Ohtani etc.) get a toggle — only one role shown at a time
  const isTwoWay       = hasPitching && hasHitting;
  const showPitchingNow = hasPitching && (!isTwoWay || twoWayRole === 'pitching');
  const showHittingNow  = hasHitting  && (!isTwoWay || twoWayRole === 'hitting');

  const isLoading = pitchLoading || hitLoading;

  // Hitting visuals
  const bats        = (person?.bats ?? 'R') as 'R' | 'L' | 'S';
  // null  = Savant fetch finished but returned nothing (CORS / no data) → show placeholder
  // undefined = still loading → show nothing yet
  // array = real data
  const sprayPoints = statcastSpray ?? null;
  const heatmap     = hitting && mlbId ? buildHeatmap(hitting, bats, mlbId)    : [];
  const wobaTrend   = gameLog.length ? buildWobaTrend(gameLog) : [];

  // Pitching visuals
  const pitchList = arsenal
    .slice()
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 7)
    .map(p => {
      const raw  = p.type as any;
      const code = raw?.code ?? raw?.displayName?.slice(0, 2).toUpperCase() ?? '??';
      const name = raw?.displayName ?? PITCH_NAMES[code] ?? code;
      return {
        code,
        name,
        usage:   parseFloat((p.percentage * 100).toFixed(1)),
        avgVelo: p.averageSpeed ?? 0,
        avgSpin: pitchSpin[code] ?? 0,
      };
    });

  const trendData = pitcherLog
    .filter(g => g.ip > 0)
    .map(g => ({
      gameIndex: g.gameIndex,
      'K/9': g.k9,
      'IP':  g.ip,
      'H':   g.h,
      'ER':  g.er,
    }));

  const pitchPct   = pitching ? buildPitchingPercentiles(pitching, pitchRanks) : [];
  const pitchRadar = pitching ? buildPitchingRadar(pitching, pitchRanks)       : [];
  const pitchIns   = pitching ? buildPitchingInsights(pitching, arsenal.length > 0) : [];

  const hitPct = hitting ? buildHittingPercentiles(hitting, hitRanks, defense?.oaa ?? null) : [];
  const hitIns = hitting ? buildHittingInsights(hitting)    : [];

  const YEAR = new Date().getFullYear();

  // OG/Twitter meta for sharing
  const actionShotUrl = mlbId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_600,d_people:generic:action:hero:current.png,q_auto:best,f_auto/v1/people/${mlbId}/action/hero/current`
    : 'https://thedugout.app/og-image.png';
  const pageTitle    = resolvedName ? `${resolvedName} · The Dugout` : 'The Dugout · MLB Analytics';
  const pageDesc     = resolvedName && person
    ? `${resolvedName} ${YEAR} stats — ${person.position ?? ''} · ${person.teamName ?? ''} | The Dugout MLB Analytics`
    : 'Advanced MLB analytics, player stats, and more.';

  return (
    <div className="pitching-page">

      {/* Dynamic meta tags for OG/Twitter sharing */}
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image" content={actionShotUrl} />
        <meta property="og:image:width" content="600" />
        <meta property="og:image:height" content="400" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={actionShotUrl} />
      </Helmet>

      {/* Empty state */}
      {!mlbId && (
        <div className="live-prompt">
          <div className="live-prompt-icon">⚾</div>
          <p>Search for any MLB player using the bar above.</p>
          <p className="live-prompt-sub">Pitchers · Hitters · Two-way players · Sources: MLB Stats API · Baseball Savant · FanGraphs</p>
        </div>
      )}

      {/* Loading */}
      {mlbId && isLoading && (
        <>
          <div className="live-loading-bar">
            <span className="live-loading-dot" />
            Fetching stats for {playerName}…
          </div>
          <StatSkeleton />
        </>
      )}

      {/* Player loaded — show as soon as person resolves, even if stats are empty */}
      {mlbId && !isLoading && (pitching || hitting || person) && (
        <>
          {/* Player hero */}
          <div className="player-hero">
            <PlayerAvatar mlbId={mlbId} name={playerName} size={110} className="player-avatar--hero" />
            <div className="player-hero-info">
              <h2 className="player-hero-name">{playerName}</h2>
              <div className="player-hero-meta">
                <Badge variant={PITCHER_POS.includes(position) ? 'accent' : 'green'}>
                  {position || '—'}
                </Badge>
                {person?.isFreeAgent
                  ? <span className="player-hero-team" style={{ color: 'var(--color-text-secondary)' }}>Free Agent</span>
                  : person?.teamName && <span className="player-hero-team">{person.teamName}</span>
                }
                {person && person.jersey > 0 && <span>#{person.jersey}</span>}
                {person && person.age    > 0 && <span>Age {person.age}</span>}
                {(person?.bats || person?.throws) && (
                  <span>Bats/Throws: {person.bats ?? '—'}/{person.throws ?? '—'}</span>
                )}
                {person?.height && <span>{person.height}</span>}
              </div>
            </div>
            {/* Two-way player toggle */}
            {isTwoWay && (
              <div className="twoway-toggle">
                <button
                  className={`twoway-toggle-btn ${twoWayRole === 'hitting' ? 'twoway-toggle-btn--active' : ''}`}
                  onClick={() => setTwoWayRole('hitting')}
                >
                  ⚾ Hitting
                </button>
                <button
                  className={`twoway-toggle-btn ${twoWayRole === 'pitching' ? 'twoway-toggle-btn--active' : ''}`}
                  onClick={() => setTwoWayRole('pitching')}
                >
                  🏹 Pitching
                </button>
              </div>
            )}
            {/* WAR badge — two-way players always show combined pitching + hitting WAR */}
            <div className="player-hero-war">
              <span className="player-hero-war-value">
                {(() => {
                  const war = isTwoWay
                    ? (pitching?.war ?? 0) + (hitting?.war ?? 0)
                    : (pitching?.war ?? hitting?.war ?? 0);
                  return war !== 0 ? war.toFixed(1) : '—';
                })()}
              </span>
              <span className="player-hero-war-label">{isTwoWay ? 'Combined fWAR' : 'fWAR'} · {YEAR}</span>

              {/* Two-way WAR split bar — only shown for players with both roles */}
              {isTwoWay && (() => {
                const batWar = hitting?.war  ?? 0;
                const pitWar = pitching?.war ?? 0;
                const total  = batWar + pitWar;
                if (total === 0) return null;
                // Clamp each segment so negative values don't break the bar
                const batPct = Math.max(0, Math.min(100, (batWar / total) * 100));
                const pitPct = 100 - batPct;
                return (
                  <div style={{ marginTop: 8, width: '100%' }}>
                    {/* Segmented bar */}
                    <div style={{ display: 'flex', height: 6, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
                      <div style={{ width: `${batPct}%`, background: 'var(--color-accent)', borderRadius: 4, transition: 'width 600ms ease' }} />
                      <div style={{ width: `${pitPct}%`, background: 'var(--color-teal)',   borderRadius: 4, transition: 'width 600ms ease' }} />
                    </div>
                    {/* Labels */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        Batting <strong style={{ color: 'var(--color-accent)' }}>{batWar.toFixed(1)}</strong>
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        Pitching <strong style={{ color: 'var(--color-teal)' }}>{pitWar.toFixed(1)}</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}
              <div className="player-hero-actions">
                {mlbId && (
                  <FavoriteButton
                    mlbId={mlbId}
                    name={playerName}
                    teamAbbr={person?.teamAbbr}
                    position={person?.position}
                  />
                )}
                <ShareButton
                  title={pageTitle}
                  text={pageDesc}
                  className="player-hero-share"
                />
              </div>
            </div>
          </div>

          {/* Tab strip */}
          <div className="player-tabs">
            {([
              { id: 'overview', label: 'Overview'  },
              { id: 'stats',    label: 'Stats Hub'  },
              { id: 'gamelog',  label: 'Game Log'   },
              { id: 'splits',   label: 'Splits'     },
              { id: 'career',   label: 'Career'     },
              { id: 'info',     label: 'Player Info' },
            ] as const).map(t => (
              <button
                key={t.id}
                className={`player-tab ${tab === t.id ? 'player-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ─── Game Log tab ─────────────────────────────────────── */}
          {tab === 'gamelog' && (
            <>
              {showPitchingNow && pitcherLog.length > 0 && (
                <Card title="Pitching Game Log" subtitle={`${pitcherLog.length} appearances this season`}>
                  <PitcherGameLogTable log={pitcherLog} />
                </Card>
              )}
              {showHittingNow && gameLog.length > 0 && (
                <Card title="Hitting Game Log" subtitle={`${gameLog.length} games this season`}>
                  <HitterGameLogTable log={gameLog} />
                </Card>
              )}
              {pitcherLog.length === 0 && gameLog.length === 0 && (
                <div className="chart-unavailable">No game log data available yet for this season.</div>
              )}
            </>
          )}

          {/* ─── Splits tab ───────────────────────────────────────── */}
          {tab === 'splits' && (
            <>
              {showPitchingNow && (
                <>
                  <SectionDivider title="Pitching Splits" color="var(--color-accent)" />
                  <SplitsPitching splits={pitchingSplits ?? null} />
                </>
              )}
              {showHittingNow && (
                <>
                  <SectionDivider title="Hitting Splits" color="var(--color-green)" />
                  <SplitsHitting splits={hittingSplits ?? null} />
                </>
              )}
            </>
          )}

          {/* ─── Career tab ───────────────────────────────────────── */}
          {tab === 'career' && (
            <CareerStatsTab
              hitting={careerHitting}
              pitching={careerPitching}
              hittingTotals={careerHitTotals}
              pitchingTotals={careerPitTotals}
              isLoading={careerLoading}
              showHitting={showHittingNow}
              showPitching={showPitchingNow}
            />
          )}

          {/* ─── Info tab ─────────────────────────────────────────── */}
          {tab === 'info' && (
            <PlayerInfoTab person={person} draftInfo={draftInfo} />
          )}

          {/* ─── Overview tab ─────────────────────────────────────── */}
          {tab === 'overview' && <>

          {/* ═══ PITCHING SECTION ═══ */}
          {showPitchingNow && pitching && pitching.games > 0 && (
            <>
              <SectionDivider title="Pitching Stats" color="var(--color-accent)" />

              {/* Core pitching grid */}
              <div className="stat-grid-4">
                <StatCard label="ERA"    value={pitching.era.toFixed(2)}           sub="Earned Run Average"     trend="up" color="accent" accent />
                <StatCard label="xERA"   value={pitching.xfip > 0 ? pitching.xfip.toFixed(2) : '—'} sub="Expected ERA (Savant)" />
                <StatCard label="WHIP"   value={pitching.whip.toFixed(2)}          sub="Walks + Hits / IP" />
                <StatCard label="K-BB%"  value={`${pitching.kBBPct.toFixed(1)}%`}  sub="K minus BB%" color="accent" />
                <StatCard label="K%"     value={`${pitching.kPct.toFixed(1)}%`}    sub="Strikeout Rate" trend="up" color="green" />
                <StatCard label="BB%"    value={`${pitching.bbPct.toFixed(1)}%`}   sub="Walk Rate" />
                <StatCard label="Whiff%" value={pitching.whiffPct > 0 ? `${pitching.whiffPct.toFixed(1)}%` : '—'} sub="Overall Whiff Rate" color="teal" />
                <StatCard label="Chase%" value={pitching.chasePct > 0 ? `${pitching.chasePct.toFixed(1)}%` : '—'} sub="Out-of-Zone Chase Rate" />
              </div>

              {/* Trend + Arsenal */}
              <div className="pitching-two-col">
                <Card
                  title="Season Performance Trend"
                  subtitle={trendData.length > 0 ? `${trendData.length} appearances · K/9, H, ER & IP per outing` : 'Game-by-game K/9, hits, earned runs and innings pitched'}
                >
                  {trendData.length === 0 ? (
                    <div className="chart-unavailable">No game log data yet for this season.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gK9" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#20b2ff" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#20b2ff" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gIP" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#00d4aa" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gH" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gER" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="gameIndex" tick={{ fill: '#4d6070', fontSize: 10 }} tickLine={false} />
                        <YAxis domain={[0, 'auto']} tick={{ fill: '#4d6070', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<PitchTooltip />} />
                        <Area type="monotone" dataKey="K/9" stroke="#20b2ff" strokeWidth={2}   fill="url(#gK9)" dot={false} />
                        <Area type="monotone" dataKey="H"   stroke="#f59e0b" strokeWidth={1.5} fill="url(#gH)"  dot={false} strokeDasharray="5 2" />
                        <Area type="monotone" dataKey="ER"  stroke="#ef4444" strokeWidth={1.5} fill="url(#gER)" dot={false} strokeDasharray="3 2" />
                        <Area type="monotone" dataKey="IP"  stroke="#00d4aa" strokeWidth={1.5} fill="url(#gIP)" dot={false} strokeDasharray="4 2" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </Card>

                <Card title="Pitch Arsenal" subtitle={pitchList.length > 0 ? `${pitchList.length} pitch types · usage & velocity` : 'Pitch type breakdown'}>
                  {pitchList.length === 0 ? (
                    <div className="chart-unavailable">Pitch arsenal data loads once enough appearances have been logged.</div>
                  ) : (
                    <div className="pitch-mix-list">
                      {pitchList.map(p => (
                        <div key={p.code} className="pitch-row">
                          <div className="pitch-type" style={{ borderColor: PITCH_COLORS[p.code] ?? '#4d6070' }}>{p.code}</div>
                          <div className="pitch-details">
                            <div className="pitch-name-row">
                              <span className="pitch-name">{p.name}</span>
                              <span className="pitch-velo">{p.avgVelo > 0 ? `${p.avgVelo.toFixed(1)} mph` : '—'}</span>
                            </div>
                            <div className="pitch-bar-track">
                              <div className="pitch-bar-fill" style={{ width: `${p.usage}%`, background: PITCH_COLORS[p.code] ?? '#4d6070' }} />
                            </div>
                          </div>
                          <div className="pitch-stats">
                            <span className="pitch-pct">{p.usage.toFixed(1)}%</span>
                            <span className="pitch-whiff">{p.avgSpin > 0 ? `${Math.round(p.avgSpin)} rpm` : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Percentiles + Radar */}
              <div className="pitching-two-col">
                <Card title="Percentile Rankings" subtitle="vs. all qualified starters">
                  <PercentileGroup items={pitchPct} />
                </Card>
                <Card title="Pitcher Profile" subtitle={pitchRanks ? 'League percentile rank · vs. qualified pitchers' : 'Normalized vs. MLB average'}>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={pitchRadar} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#7f93a8', fontSize: 11 }} />
                      {/* No tick labels — they clutter the centre of the chart */}
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Rating" dataKey="value" stroke="#20b2ff" fill="#20b2ff" fillOpacity={0.20} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Season summary + Insights */}
              <div className="pitching-two-col">
                <Card title="Season Summary" subtitle="Advanced metrics breakdown">
                  <div className="count-grid">
                    {[
                      { label: 'K/9',    value: pitching.k9.toFixed(1) },
                      { label: 'BB/9',   value: pitching.bb9.toFixed(1) },
                      { label: 'HR/9',   value: pitching.hr9.toFixed(1) },
                      { label: 'GB%',    value: pitching.gbPct > 0 ? `${pitching.gbPct.toFixed(1)}%` : '—' },
                      { label: 'LD%',    value: pitching.ldPct > 0 ? `${pitching.ldPct.toFixed(1)}%` : '—' },
                      { label: 'FB%',    value: pitching.fbPct > 0 ? `${pitching.fbPct.toFixed(1)}%` : '—' },
                      { label: 'Avg FB', value: pitching.avgVelocity > 0 ? `${pitching.avgVelocity.toFixed(1)}` : '—' },
                      { label: 'xERA',   value: pitching.xfip > 0 ? pitching.xfip.toFixed(2) : '—' },
                    ].map(s => (
                      <div key={s.label} className="count-stat">
                        <span className="count-stat-label">{s.label}</span>
                        <span className="count-stat-value">{s.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="season-summary">
                    <div className="season-line">
                      {pitching.wins}W–{pitching.losses}L · {pitching.inningsPitched.toFixed(1)} IP · {pitching.games} G
                    </div>
                    <div className="season-wpa">WHIP: {pitching.whip.toFixed(2)} · K-BB%: {pitching.kBBPct.toFixed(1)}%</div>
                  </div>
                </Card>
                <InsightPanel insights={pitchIns} title="Pitching Intelligence" />
              </div>
            </>
          )}

          {/* ═══ HITTING SECTION ═══ */}
          {showHittingNow && hitting && hitting.games > 0 && (
            <>
              <SectionDivider title="Hitting Stats" color="var(--color-green)" />

              {/* Core hitting grid */}
              <div className="stat-grid-4">
                <StatCard label="AVG"   value={hitting.avg.toFixed(3)}  sub="Batting Average"   color="accent" accent />
                <StatCard label="OBP"   value={hitting.obp.toFixed(3)}  sub="On-Base Pct"        color="accent" />
                <StatCard label="SLG"   value={hitting.slg.toFixed(3)}  sub="Slugging Pct" />
                <StatCard label="OPS"   value={hitting.ops.toFixed(3)}  sub="OBP + SLG"          color="green" />
                <StatCard label="wOBA"  value={hitting.woba > 0 ? hitting.woba.toFixed(3) : '—'} sub="Weighted On-Base" trend="up" color="accent" accent />
                <StatCard label="wRC+"  value={hitting.wrcPlus > 0 ? hitting.wrcPlus.toString() : '—'} sub="Weighted Runs Created+" color="purple" />
                <StatCard label="ISO"   value={hitting.iso.toFixed(3)}  sub="Isolated Power" />
                <StatCard label="BABIP" value={hitting.babip > 0 ? hitting.babip.toFixed(3) : '—'} sub="Batting Avg on BIP" />
              </div>

              {/* Contact quality */}
              <div className="stat-grid-4">
                <StatCard label="Exit Velo"   value={hitting.exitVelo   > 0 ? `${hitting.exitVelo.toFixed(1)}`    : '—'} sub="Avg Exit Velocity (mph)" trend="up" color="amber" />
                <StatCard label="Barrel %"    value={hitting.barrelPct  > 0 ? `${hitting.barrelPct.toFixed(1)}%`  : '—'} sub="Barrel Rate"             color="red" accent />
                <StatCard label="Hard Hit %"  value={hitting.hardHitPct > 0 ? `${hitting.hardHitPct.toFixed(1)}%` : '—'} sub="Hard Hit Rate"           color="amber" />
                <StatCard label="Sweet Spot%" value={hitting.sweetSpotPct > 0 ? `${hitting.sweetSpotPct.toFixed(1)}%` : '—'} sub="8–32° Launch Angle" />
                <StatCard label="K%"   value={`${hitting.kPct.toFixed(1)}%`} sub="Strikeout Rate" />
                <StatCard label="BB%"  value={`${hitting.bbPct.toFixed(1)}%`} sub="Walk Rate" color="green" />
                <StatCard label="HR"   value={hitting.homeRuns.toString()} sub={`${hitting.games} G`} color="red" />
                <StatCard label="SB"   value={hitting.stolenBases.toString()} sub="Stolen Bases" color="teal" />
              </div>

              {/* Visual row */}
              <div className="hitting-three-col">
                {/* Spray chart */}
                <Card
                  title="Spray Chart"
                  subtitle={sprayPoints ? `${hitting.hits} H · ${hitting.homeRuns} HR · bats ${bats} · Statcast` : `${hitting.hits} H · ${hitting.homeRuns} HR · bats ${bats}`}
                  className="span-1"
                >
                  {sprayLoading ? (
                    <div className="spray-loading">Loading Statcast data…</div>
                  ) : sprayPoints ? (
                    <div className="spray-chart-wrap">
                      {/*
                        PNG calibration (1206×1088 RGBA field-grayscale.png → 500×420 SVG):
                          CF fence top  img≈(603,   1) → SVG (250,  21)
                          home plate    img≈(603,1065) → SVG (250, 380)
                          x=0  (603 × 500/1206 = 250 ✓)
                          width=500   height=367  y=21  (359px = 1064 img-rows × 367/1088)
                      */}
                      <svg viewBox="0 0 500 420" className="spray-svg spray-svg--field">
                        <image href="/field.png" x="0" y="21" width="500" height="367" preserveAspectRatio="none" />
                        {sprayPoints.map((pt, i) => (
                          <circle key={i} cx={pt.x} cy={pt.y}
                            r={pt.type === 'hr' ? 6 : pt.type === 'out' ? 3 : 4.5}
                            fill={SPRAY_COLORS[pt.type]}
                            stroke="rgba(0,0,0,0.35)"
                            strokeWidth={pt.type === 'out' ? 0 : 0.8}
                            opacity={pt.type === 'out' ? 0.45 : 0.88} />
                        ))}
                      </svg>
                      <div className="spray-legend">
                        {Object.entries(SPRAY_COLORS).map(([type, color]) => (
                          <span key={type} className="spray-legend-item">
                            <span className="spray-dot" style={{ background: color === 'rgba(100,120,140,0.4)' ? '#4d6070' : color }} />
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="spray-unavailable">
                      <svg viewBox="0 0 500 420" className="spray-svg spray-svg--field spray-svg--dim">
                        <image href="/field.png" x="0" y="21" width="500" height="367" preserveAspectRatio="none" opacity="0.4" />
                        <text x="250" y="195" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="13" fontFamily="var(--font-mono)">Statcast unavailable</text>
                        <text x="250" y="213" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="var(--font-mono)">baseballsavant.mlb.com</text>
                      </svg>
                    </div>
                  )}
                </Card>

                {/* Hot/cold zones */}
                <Card
                  title="Hot/Cold Zones"
                  subtitle={zoneData ? 'Statcast wOBA by zone (in-zone PA only)' : 'Estimated wOBA by strike zone area'}
                  className="span-1"
                >
                  <div className="heatmap-wrap">
                    {zoneData ? (
                      /* ── Real 3×3 Statcast grid (zones 1-9, reading order) ── */
                      <div className="heatmap-grid heatmap-grid--3x3">
                        {Array.from({ length: 3 }, (_, row) =>
                          Array.from({ length: 3 }, (_, col) => {
                            const zoneNum = row * 3 + col + 1; // 1-9
                            const entry   = zoneData.find(z => z.zone === zoneNum);
                            const val     = entry?.woba ?? 0.32;
                            const count   = entry?.count ?? 0;
                            const bg      = val > 0.420
                              ? `rgba(239,68,68,${Math.min(0.9, 0.55 + (val - 0.42) * 3)})`
                              : val < 0.280
                                ? `rgba(32,178,255,${Math.min(0.85, 0.4 + (0.28 - val) * 3)})`
                                : `rgba(245,158,11,${0.25 + (val - 0.28) / (0.42 - 0.28) * 0.45})`;
                            return (
                              <div key={zoneNum} className="heat-cell heat-cell--lg" style={{ background: bg }}>
                                <span className="heat-val">{val.toFixed(3)}</span>
                                {count > 0 && <span className="heat-count">{count} PA</span>}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      /* ── Fallback 5×5 generated grid ── */
                      <div className="heatmap-grid">
                        {Array.from({ length: 5 }, (_, row) =>
                          Array.from({ length: 5 }, (_, col) => {
                            const zone = heatmap.find(z => z.row === row + 2 && z.col === col + 2);
                            const val  = zone?.value ?? 0.3;
                            const bg   = val > 0.42
                              ? `rgba(239,68,68,${val * 0.9})`
                              : val < 0.28
                                ? `rgba(32,178,255,${0.8 - val})`
                                : `rgba(245,158,11,${val})`;
                            return (
                              <div key={`${row}-${col}`} className="heat-cell" style={{ background: bg }}>
                                <span className="heat-val">{val.toFixed(3)}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                    <div className="heatmap-labels">
                      <span>Cool</span>
                      <div className="heatmap-gradient" />
                      <span>Hot</span>
                    </div>
                  </div>
                </Card>

                {/* wOBA trend */}
                <Card title="wOBA Rolling Trend"
                  subtitle={gameLog.length ? `${gameLog.length}-game log · 10-game rolling avg` : 'No game log data yet'}
                  className="span-1">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={wobaTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="wobaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#20b2ff" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#20b2ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="date" tick={{ fill: '#4d6070', fontSize: 9 }} tickLine={false} interval={4} />
                      <YAxis domain={[0.25, 0.5]} tick={{ fill: '#4d6070', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(3)} />
                      <Tooltip content={<HitTooltip />} />
                      <ReferenceLine y={0.320} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 2" label={{ value: 'Avg', fill: '#4d6070', fontSize: 9 }} />
                      <Area type="monotone" dataKey="value" name="wOBA" stroke="#20b2ff" strokeWidth={2} fill="url(#wobaGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Percentiles + Profile + Insights */}
              <div className="hitting-two-col">
                <Card title="Percentile Rankings" subtitle="vs. all qualified hitters">
                  <PercentileGroup items={hitPct} />
                </Card>
                <div className="hitting-right-col">
                  <Card title="Batted Ball Profile">
                    <div className="bb-profile-grid">
                      {[
                        { label: 'GB%', value: hitting.gbPct,  color: '#f59e0b' },
                        { label: 'FB%', value: hitting.fbPct,  color: '#20b2ff' },
                        { label: 'LD%', value: hitting.ldPct,  color: '#22c55e' },
                      ].map(b => (
                        <div key={b.label} className="bb-item">
                          <span className="bb-label">{b.label}</span>
                          <div className="bb-bar-track">
                            <div className="bb-bar-fill" style={{ width: `${b.value}%`, background: b.color }} />
                          </div>
                          <span className="bb-value" style={{ color: b.color }}>{b.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="direction-grid">
                      {[
                        { label: 'Pull%',   value: hitting.pullPct },
                        { label: 'Center%', value: hitting.centPct },
                        { label: 'Oppo%',   value: hitting.oppoShotPct },
                      ].map(d => (
                        <div key={d.label} className="direction-stat">
                          <span className="direction-label">{d.label}</span>
                          <span className="direction-value">{d.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <InsightPanel insights={hitIns} title="Hitting Intelligence" />
                </div>
              </div>
            </>
          )}

          {/* ═══ DEFENSE SECTION ═══ */}
          {defense && defense.games > 0 && !PITCHER_POS.includes(position) && (
            <>
              <SectionDivider title="Defensive Stats" color="var(--color-teal)" />
              <div className="stat-grid-4">
                <StatCard
                  label="OAA"
                  value={defense.oaa !== null ? (defense.oaa > 0 ? `+${defense.oaa.toFixed(0)}` : defense.oaa.toFixed(0)) : '—'}
                  sub="Outs Above Average"
                  color={defense.oaa !== null && defense.oaa > 0 ? 'teal' : defense.oaa !== null && defense.oaa < 0 ? 'red' : 'default'}
                  accent={defense.oaa !== null && defense.oaa > 5}
                />
                <StatCard
                  label="DRS"
                  value={defense.drs !== null ? (defense.drs > 0 ? `+${defense.drs.toFixed(0)}` : defense.drs.toFixed(0)) : '—'}
                  sub="Defensive Runs Saved"
                  color={defense.drs !== null && defense.drs > 0 ? 'green' : 'default'}
                />
                {defense.uzr150 !== null && (
                  <StatCard
                    label="UZR/150"
                    value={defense.uzr150 > 0 ? `+${defense.uzr150.toFixed(1)}` : defense.uzr150.toFixed(1)}
                    sub="UZR per 150 Games"
                    color="accent"
                  />
                )}
                <StatCard
                  label="Defense"
                  value={defense.defense !== null ? (defense.defense > 0 ? `+${defense.defense.toFixed(1)}` : defense.defense.toFixed(1)) : '—'}
                  sub="FanGraphs Composite"
                  color="purple"
                />
                <StatCard label="FLD%"    value={defense.fieldingPct ? defense.fieldingPct.toFixed(3) : '—'} sub="Fielding Percentage" />
                <StatCard label="Errors"  value={defense.errors.toString()} sub={`${defense.games} G · ${defense.pos}`} />
                <StatCard label="Assists" value={defense.assists.toString()} sub="Total Assists" />
                <StatCard
                  label={defense.pos === 'C' ? 'Framing' : 'Putouts'}
                  value={defense.pos === 'C' && defense.cFraming !== null
                    ? (defense.cFraming > 0 ? `+${defense.cFraming.toFixed(1)}` : defense.cFraming.toFixed(1))
                    : defense.putouts.toString()}
                  sub={defense.pos === 'C' ? 'Catcher Framing Runs' : 'Total Putouts'}
                  color={defense.pos === 'C' ? 'accent' : 'default'}
                />
              </div>
            </>
          )}

          {/* No data found at all */}
          {!pitching && !hitting && (
            <div className="page-empty">No stats found for this player this season.</div>
          )}

          </>} {/* end overview tab */}

          {/* ─── All Stats tab ────────────────────────────────────── */}
          {tab === 'stats' && (
            <div className="allstats-tab">

              {/* Empty state */}
              {!hitting && !pitching && (
                <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '3rem 0' }}>
                  No {new Date().getFullYear()} stats available yet.
                </p>
              )}

              {/* ── HITTING ── */}
              {hasHitting && hitting && (<>
                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>Standard</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'G',   v: String(hitting.games) },
                      { l: 'PA',  v: String(hitting.plateAppearances) },
                      { l: 'AB',  v: String(hitting.atBats) },
                      { l: 'H',   v: String(hitting.hits) },
                      { l: '1B',  v: String(Math.max(0, hitting.hits - hitting.doubles - hitting.triples - hitting.homeRuns)) },
                      { l: '2B',  v: String(hitting.doubles) },
                      { l: '3B',  v: String(hitting.triples) },
                      { l: 'HR',  v: String(hitting.homeRuns), c: hitting.homeRuns >= 20 ? '#ef4444' : undefined },
                      { l: 'R',   v: String(hitting.runs) },
                      { l: 'RBI', v: String(hitting.rbi) },
                      { l: 'SB',  v: String(hitting.stolenBases), c: hitting.stolenBases >= 20 ? 'var(--color-teal)' : undefined },
                      { l: 'BB',  v: String(hitting.walks) },
                      { l: 'SO',  v: String(hitting.strikeouts) },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-green)' }}>Rate Stats</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'AVG',   v: hitting.avg > 0   ? hitting.avg.toFixed(3).replace('0.','.') : '—',   c: hitting.avg >= 0.280 ? 'var(--color-teal)' : hitting.avg < 0.220 ? '#ef4444' : undefined },
                      { l: 'OBP',   v: hitting.obp > 0   ? hitting.obp.toFixed(3).replace('0.','.') : '—',   c: hitting.obp >= 0.360 ? 'var(--color-teal)' : hitting.obp < 0.300 ? '#ef4444' : undefined },
                      { l: 'SLG',   v: hitting.slg > 0   ? hitting.slg.toFixed(3).replace('0.','.') : '—',   c: hitting.slg >= 0.500 ? 'var(--color-teal)' : undefined },
                      { l: 'OPS',   v: hitting.ops > 0   ? hitting.ops.toFixed(3).replace('0.','.') : '—',   c: hitting.ops >= 0.850 ? 'var(--color-teal)' : hitting.ops < 0.650 ? '#ef4444' : undefined },
                      { l: 'wOBA',  v: hitting.woba > 0  ? hitting.woba.toFixed(3).replace('0.','.') : '—',  c: hitting.woba >= 0.360 ? 'var(--color-teal)' : hitting.woba < 0.290 ? '#ef4444' : undefined },
                      { l: 'wRC+',  v: hitting.wrcPlus > 0 ? String(hitting.wrcPlus) : '—',                  c: hitting.wrcPlus >= 130 ? 'var(--color-teal)' : hitting.wrcPlus < 80 ? '#ef4444' : undefined },
                      { l: 'ISO',   v: hitting.iso > 0   ? hitting.iso.toFixed(3).replace('0.','.') : '—',   c: hitting.iso >= 0.200 ? 'var(--color-teal)' : undefined },
                      { l: 'BABIP', v: hitting.babip > 0 ? hitting.babip.toFixed(3).replace('0.','.') : '—' },
                      { l: 'BB%',   v: hitting.bbPct > 0 ? `${hitting.bbPct.toFixed(1)}%` : '—',             c: hitting.bbPct >= 12 ? 'var(--color-teal)' : undefined },
                      { l: 'K%',    v: hitting.kPct > 0  ? `${hitting.kPct.toFixed(1)}%` : '—',              c: hitting.kPct >= 30 ? '#ef4444' : hitting.kPct <= 14 ? 'var(--color-teal)' : undefined },
                      { l: 'BB/K',  v: hitting.bbKRatio > 0 ? hitting.bbKRatio.toFixed(2) : '—',             c: hitting.bbKRatio >= 0.50 ? 'var(--color-teal)' : undefined },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-amber)' }}>Statcast · Contact Quality</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'Exit Velo',   v: hitting.exitVelo > 0     ? `${hitting.exitVelo.toFixed(1)} mph`    : '—', c: hitting.exitVelo >= 92 ? 'var(--color-teal)' : hitting.exitVelo > 0 && hitting.exitVelo < 87 ? '#ef4444' : undefined },
                      { l: 'Launch Ang',  v: hitting.launchAngle !== 0 ? `${hitting.launchAngle.toFixed(1)}°`   : '—' },
                      { l: 'Barrel%',     v: hitting.barrelPct > 0    ? `${hitting.barrelPct.toFixed(1)}%`      : '—', c: hitting.barrelPct >= 10 ? 'var(--color-teal)' : hitting.barrelPct > 0 && hitting.barrelPct < 4 ? '#ef4444' : undefined },
                      { l: 'Hard Hit%',   v: hitting.hardHitPct > 0   ? `${hitting.hardHitPct.toFixed(1)}%`    : '—', c: hitting.hardHitPct >= 45 ? 'var(--color-teal)' : hitting.hardHitPct > 0 && hitting.hardHitPct < 30 ? '#ef4444' : undefined },
                      { l: 'Sweet Spot%', v: hitting.sweetSpotPct > 0 ? `${hitting.sweetSpotPct.toFixed(1)}%`  : '—', c: hitting.sweetSpotPct >= 35 ? 'var(--color-teal)' : undefined },
                      { l: 'GB%',         v: hitting.gbPct > 0        ? `${hitting.gbPct.toFixed(1)}%`         : '—' },
                      { l: 'FB%',         v: hitting.fbPct > 0        ? `${hitting.fbPct.toFixed(1)}%`         : '—' },
                      { l: 'LD%',         v: hitting.ldPct > 0        ? `${hitting.ldPct.toFixed(1)}%`         : '—', c: hitting.ldPct >= 22 ? 'var(--color-teal)' : undefined },
                      { l: 'Pull%',       v: hitting.pullPct > 0      ? `${hitting.pullPct.toFixed(1)}%`       : scNum(scBat, 'pull_percent') !== '—' ? `${scNum(scBat, 'pull_percent')}%` : '—' },
                      { l: 'Cent%',       v: hitting.centPct > 0      ? `${hitting.centPct.toFixed(1)}%`       : scNum(scBat, 'straightaway_percent') !== '—' ? `${scNum(scBat, 'straightaway_percent')}%` : '—' },
                      { l: 'Oppo%',       v: hitting.oppoShotPct > 0  ? `${hitting.oppoShotPct.toFixed(1)}%`  : scNum(scBat, 'opposite_percent') !== '—' ? `${scNum(scBat, 'opposite_percent')}%` : '—' },
                      { l: 'Sprint',      v: hitting.sprint > 0       ? `${hitting.sprint.toFixed(1)} ft/s`    : '—', c: hitting.sprint >= 27 ? 'var(--color-teal)' : hitting.sprint > 0 && hitting.sprint < 24 ? '#ef4444' : undefined },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>Statcast · Expected Stats (xStats)</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'xBA',     v: xBat && xBat.xba   ? xBat.xba.toFixed(3)   : '—', c: xBat && xBat.xba >= 0.280 ? 'var(--color-teal)' : xBat && xBat.xba < 0.220 ? '#ef4444' : undefined },
                      { l: 'xSLG',    v: xBat && xBat.xslg  ? xBat.xslg.toFixed(3)  : '—', c: xBat && xBat.xslg >= 0.480 ? 'var(--color-teal)' : undefined },
                      { l: 'xwOBA',   v: xBat && xBat.xwoba ? xBat.xwoba.toFixed(3) : '—', c: xBat && xBat.xwoba >= 0.360 ? 'var(--color-teal)' : xBat && xBat.xwoba < 0.290 ? '#ef4444' : undefined },
                      { l: 'wOBA',    v: xBat && xBat.woba  ? xBat.woba.toFixed(3)  : hitting.woba > 0 ? hitting.woba.toFixed(3).replace('0.', '.') : '—' },
                      { l: 'xISO',    v: xBat && xBat.xiso  ? xBat.xiso.toFixed(3)  : '—', c: xBat && xBat.xiso >= 0.200 ? 'var(--color-teal)' : undefined },
                      { l: 'BA−xBA',  v: xBat ? (xBat.baxba >= 0 ? '+' : '') + xBat.baxba.toFixed(3) : '—',
                        c: xBat ? (xBat.baxba > 0.015 ? 'var(--color-green)' : xBat.baxba < -0.015 ? '#ef4444' : undefined) : undefined },
                      { l: 'SLG−xSLG', v: xBat ? (xBat.slgxslg >= 0 ? '+' : '') + xBat.slgxslg.toFixed(3) : '—',
                        c: xBat ? (xBat.slgxslg > 0.020 ? 'var(--color-green)' : xBat.slgxslg < -0.020 ? '#ef4444' : undefined) : undefined },
                      { l: 'wOBA−xwOBA', v: xBat ? (xBat.wobaxwoba >= 0 ? '+' : '') + xBat.wobaxwoba.toFixed(3) : '—',
                        c: xBat ? (xBat.wobaxwoba > 0.015 ? 'var(--color-green)' : xBat.wobaxwoba < -0.015 ? '#ef4444' : undefined) : undefined },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-purple)' }}>Statcast · Plate Discipline</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'Whiff%',  v: hitting.whiffPct > 0 ? `${hitting.whiffPct.toFixed(1)}%` : scNum(scBat, 'whiff_percent') !== '—' ? `${scNum(scBat, 'whiff_percent')}%` : '—',
                        c: hitting.whiffPct < 18 ? 'var(--color-teal)' : hitting.whiffPct > 28 ? '#ef4444' : undefined },
                      { l: 'Chase%',  v: hitting.chasePct > 0 ? `${hitting.chasePct.toFixed(1)}%` : scNum(scBat, 'chase_percent') !== '—' ? `${scNum(scBat, 'chase_percent')}%` : '—',
                        c: hitting.chasePct < 20 ? 'var(--color-teal)' : hitting.chasePct > 33 ? '#ef4444' : undefined },
                      { l: 'K%',      v: hitting.kPct > 0  ? `${hitting.kPct.toFixed(1)}%`  : '—', c: hitting.kPct > 28 ? '#ef4444' : hitting.kPct < 15 ? 'var(--color-teal)' : undefined },
                      { l: 'BB%',     v: hitting.bbPct > 0 ? `${hitting.bbPct.toFixed(1)}%` : '—', c: hitting.bbPct > 12 ? 'var(--color-teal)' : undefined },
                      { l: 'BABIP',   v: hitting.babip > 0 ? hitting.babip.toFixed(3).replace('0.','.') : '—' },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-purple)' }}>Win Probability & Value</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'WAR',    v: hitting.war !== 0   ? hitting.war.toFixed(1)  : '—',   c: hitting.war >= 4 ? 'var(--color-teal)' : hitting.war < 0 ? '#ef4444' : undefined },
                      { l: 'WPA',    v: hitting.wpa !== 0  ? (hitting.wpa >= 0 ? '+' : '') + hitting.wpa.toFixed(2) : '—', c: hitting.wpa >= 0 ? 'var(--color-teal)' : '#ef4444' },
                      { l: 'RE24',   v: hitting.re24 !== 0 ? (hitting.re24 >= 0 ? '+' : '') + hitting.re24.toFixed(1) : '—', c: hitting.re24 >= 0 ? 'var(--color-teal)' : '#ef4444' },
                      { l: 'Clutch', v: hitting.clutch !== 0 ? (hitting.clutch >= 0 ? '+' : '') + hitting.clutch.toFixed(2) : '—', c: hitting.clutch >= 0.5 ? 'var(--color-teal)' : hitting.clutch <= -0.5 ? '#ef4444' : undefined },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>
              </>)}

              {/* ── PITCHING ── */}
              {hasPitching && pitching && (<>
                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>Standard</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'G',   v: String(pitching.games) },
                      { l: 'GS',  v: String(pitching.gamesStarted) },
                      { l: 'W',   v: String(pitching.wins) },
                      { l: 'L',   v: String(pitching.losses) },
                      { l: 'SV',  v: pitching.saves > 0 ? String(pitching.saves) : '—' },
                      { l: 'IP',  v: pitching.inningsPitched > 0 ? pitching.inningsPitched.toFixed(1) : '—' },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-teal)' }}>Rate Stats</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'ERA',   v: pitching.era > 0   ? pitching.era.toFixed(2)   : '—', c: pitching.era <= 3.0 ? 'var(--color-teal)' : pitching.era >= 5.0 ? '#ef4444' : undefined },
                      { l: 'FIP',   v: pitching.fip !== 0  ? pitching.fip.toFixed(2)   : '—', c: pitching.fip <= 3.2 ? 'var(--color-teal)' : pitching.fip >= 4.8 ? '#ef4444' : undefined },
                      { l: 'xFIP',  v: pitching.xfip > 0  ? pitching.xfip.toFixed(2)  : '—', c: pitching.xfip > 0 && pitching.xfip <= 3.2 ? 'var(--color-teal)' : pitching.xfip >= 4.8 ? '#ef4444' : undefined },
                      { l: 'WHIP',  v: pitching.whip > 0  ? pitching.whip.toFixed(2)  : '—', c: pitching.whip <= 1.10 ? 'var(--color-teal)' : pitching.whip >= 1.40 ? '#ef4444' : undefined },
                      { l: 'K%',    v: pitching.kPct > 0  ? `${pitching.kPct.toFixed(1)}%`  : '—', c: pitching.kPct >= 28 ? 'var(--color-teal)' : pitching.kPct < 16 ? '#ef4444' : undefined },
                      { l: 'BB%',   v: pitching.bbPct > 0 ? `${pitching.bbPct.toFixed(1)}%` : '—', c: pitching.bbPct <= 6 ? 'var(--color-teal)' : pitching.bbPct >= 10 ? '#ef4444' : undefined },
                      { l: 'K-BB%', v: pitching.kBBPct > 0 ? `${pitching.kBBPct.toFixed(1)}%` : '—', c: pitching.kBBPct >= 18 ? 'var(--color-teal)' : pitching.kBBPct < 8 ? '#ef4444' : undefined },
                      { l: 'K/9',   v: pitching.k9 > 0   ? pitching.k9.toFixed(1)   : '—', c: pitching.k9 >= 10 ? 'var(--color-teal)' : undefined },
                      { l: 'BB/9',  v: pitching.bb9 > 0  ? pitching.bb9.toFixed(1)  : '—', c: pitching.bb9 <= 2.5 ? 'var(--color-teal)' : pitching.bb9 >= 4.0 ? '#ef4444' : undefined },
                      { l: 'HR/9',  v: pitching.hr9 > 0  ? pitching.hr9.toFixed(2)  : '—', c: pitching.hr9 >= 1.5 ? '#ef4444' : pitching.hr9 <= 0.7 ? 'var(--color-teal)' : undefined },
                      { l: 'BABIP', v: pitching.babip > 0 ? pitching.babip.toFixed(3).replace('0.','.') : '—' },
                      { l: 'LOB%',  v: pitching.lobPct > 0 ? `${pitching.lobPct.toFixed(1)}%` : '—', c: pitching.lobPct >= 78 ? 'var(--color-teal)' : pitching.lobPct < 68 ? '#ef4444' : undefined },
                      { l: 'GB%',   v: pitching.gbPct > 0  ? `${pitching.gbPct.toFixed(1)}%`  : '—', c: pitching.gbPct >= 50 ? 'var(--color-teal)' : undefined },
                      { l: 'FB%',   v: pitching.fbPct > 0  ? `${pitching.fbPct.toFixed(1)}%`  : '—' },
                      { l: 'LD%',   v: pitching.ldPct > 0  ? `${pitching.ldPct.toFixed(1)}%`  : '—' },
                      { l: 'HR/FB', v: pitching.hrFbPct > 0 ? `${pitching.hrFbPct.toFixed(1)}%` : '—', c: pitching.hrFbPct >= 13 ? '#ef4444' : pitching.hrFbPct <= 7 ? 'var(--color-teal)' : undefined },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-amber)' }}>Velocity & Stuff</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'Avg Velo',  v: pitching.avgVelocity > 0 ? `${pitching.avgVelocity.toFixed(1)} mph` : '—', c: pitching.avgVelocity >= 96 ? 'var(--color-teal)' : pitching.avgVelocity > 0 && pitching.avgVelocity < 90 ? '#ef4444' : undefined },
                      { l: 'Whiff%',   v: pitching.whiffPct > 0 ? `${pitching.whiffPct.toFixed(1)}%` : '—', c: pitching.whiffPct >= 27 ? 'var(--color-teal)' : pitching.whiffPct > 0 && pitching.whiffPct < 18 ? '#ef4444' : undefined },
                      { l: 'Chase%',   v: pitching.chasePct > 0 ? `${pitching.chasePct.toFixed(1)}%` : '—', c: pitching.chasePct >= 32 ? 'var(--color-teal)' : undefined },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-purple)' }}>Value</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'WAR',  v: pitching.war !== 0  ? pitching.war.toFixed(1)  : '—',  c: pitching.war >= 3 ? 'var(--color-teal)' : pitching.war < 0 ? '#ef4444' : undefined },
                      { l: 'WPA',  v: pitching.wpa !== 0 ? (pitching.wpa >= 0 ? '+' : '') + pitching.wpa.toFixed(2) : '—', c: pitching.wpa >= 0 ? 'var(--color-teal)' : '#ef4444' },
                      { l: 'RE24', v: pitching.re24 !== 0 ? (pitching.re24 >= 0 ? '+' : '') + pitching.re24.toFixed(1) : '—', c: pitching.re24 >= 0 ? 'var(--color-teal)' : '#ef4444' },
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} />
                    ))}
                  </div>
                </div>

                {/* Pitch Arsenal */}
                {pitchList.length > 0 && (
                  <div className="allstats-section">
                    <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>Pitch Arsenal</div>
                    <div className="career-table-wrap">
                      <table className="career-table">
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left' }}>Pitch</th>
                            <th>Usage%</th><th>Avg Velo</th><th>Spin RPM</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pitchList.map(p => (
                            <tr key={p.code}>
                              <td style={{ textAlign: 'left' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: PITCH_COLORS[p.code] ?? '#888', flexShrink: 0 }} />
                                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans, Inter)' }}>{p.name}</span>
                                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{p.code}</span>
                                </span>
                              </td>
                              <td style={{ color: PITCH_COLORS[p.code] ?? undefined, fontWeight: 700 }}>{p.usage.toFixed(1)}%</td>
                              <td>{p.avgVelo > 0 ? `${p.avgVelo.toFixed(1)} mph` : '—'}</td>
                              <td>{p.avgSpin > 0 ? p.avgSpin.toLocaleString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>)}

              {/* ── DEFENSE ── */}
              {defense && defense.games > 0 && (
                <div className="allstats-section">
                  <div className="allstats-section-header" style={{ borderLeftColor: 'var(--color-teal)' }}>Defense</div>
                  <div className="allstats-grid">
                    {[
                      { l: 'G',       v: String(defense.games) },
                      { l: 'Inn',     v: defense.innings > 0 ? defense.innings.toFixed(1) : '—' },
                      { l: 'FLD%',    v: defense.fieldingPct > 0 ? defense.fieldingPct.toFixed(3) : '—' },
                      { l: 'E',       v: String(defense.errors), c: defense.errors >= 10 ? '#ef4444' : undefined },
                      { l: 'A',       v: String(defense.assists) },
                      { l: 'PO',      v: String(defense.putouts) },
                      { l: 'OAA',     v: defense.oaa != null ? (defense.oaa >= 0 ? '+' : '') + defense.oaa.toFixed(0) : '—', c: (defense.oaa ?? 0) > 0 ? 'var(--color-teal)' : (defense.oaa ?? 0) < 0 ? '#ef4444' : undefined },
                      { l: 'DRS',     v: defense.drs != null ? (defense.drs >= 0 ? '+' : '') + defense.drs.toFixed(0) : '—', c: (defense.drs ?? 0) > 0 ? 'var(--color-teal)' : (defense.drs ?? 0) < 0 ? '#ef4444' : undefined },
                      ...(defense.uzr != null ? [{ l: 'UZR', v: (defense.uzr >= 0 ? '+' : '') + defense.uzr.toFixed(1), c: defense.uzr > 0 ? 'var(--color-teal)' : defense.uzr < 0 ? '#ef4444' : undefined }] : []),
                      ...(defense.uzr150 != null ? [{ l: 'UZR/150', v: (defense.uzr150 >= 0 ? '+' : '') + defense.uzr150.toFixed(1), c: defense.uzr150 > 0 ? 'var(--color-teal)' : defense.uzr150 < 0 ? '#ef4444' : undefined }] : []),
                      ...(['LF','CF','RF','OF'].includes(String(defense.pos)) ? [
                        { l: 'ARM', v: defense.armR != null ? (defense.armR >= 0 ? '+' : '') + defense.armR.toFixed(1) : '—', c: (defense.armR ?? 0) > 0 ? 'var(--color-teal)' : (defense.armR ?? 0) < 0 ? '#ef4444' : undefined, note: defense.armR == null ? 'updated mid-season' : undefined },
                      ] : []),
                      ...(defense.cFraming != null ? [{ l: 'Framing', v: (defense.cFraming >= 0 ? '+' : '') + defense.cFraming.toFixed(1), c: defense.cFraming > 0 ? 'var(--color-teal)' : defense.cFraming < 0 ? '#ef4444' : undefined }] : []),
                    ].map(s => (
                      <ACell key={s.l} l={s.l} v={s.v} c={(s as any).c} note={(s as any).note} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}
    </div>
  );
}
