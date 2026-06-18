import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import TeamLogo from '../../components/ui/TeamLogo';
import {
  useBattingLeaderboard,
  usePitchingLeaderboard,
  useDefenseLeaderboard,
} from '../../hooks/useMLBData';
import type { FanGraphsBatterRow, FanGraphsPitcherRow, FanGraphsFieldingStats } from '../../data/api/fangraphs';
import '../../styles/shared.css';
import './GemsPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GemSection<T> {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  icon: string;
  rows: T[];
  renderRow: (row: T, rank: number) => React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct1 = (v: number) => `${v.toFixed(1)}%`;
const dec3 = (v: number) => v.toFixed(3).replace(/^0\./, '.');
const dec2 = (v: number) => v.toFixed(2);
const signed = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

// ─── Shared player row layout ─────────────────────────────────────────────────

function GemRow({
  rank,
  mlbId,
  name,
  team,
  pos,
  accentStat,
  accentLabel,
  accentColor,
  stats,
  onClick,
}: {
  rank: number;
  mlbId: number;
  name: string;
  team: string;
  pos?: string;
  accentStat: string;
  accentLabel: string;
  accentColor: string;
  stats: { label: string; value: string }[];
  onClick: () => void;
}) {
  return (
    <div className="gem-row" onClick={onClick}>
      <span className="gem-rank">{rank}</span>
      <PlayerAvatar mlbId={mlbId} name={name} size={36} />
      <div className="gem-identity">
        <span className="gem-name">{name}</span>
        <span className="gem-team">
          <TeamLogo abbr={team} size={14} />
          {team}{pos ? ` · ${pos}` : ''}
        </span>
      </div>
      <div className="gem-accent" style={{ color: accentColor }}>
        <span className="gem-accent-value">{accentStat}</span>
        <span className="gem-accent-label">{accentLabel}</span>
      </div>
      <div className="gem-stats">
        {stats.map(s => (
          <div key={s.label} className="gem-stat">
            <span className="gem-stat-value">{s.value}</span>
            <span className="gem-stat-label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  accent,
  icon,
  isLoading,
  children,
  empty,
}: {
  title: string;
  subtitle: string;
  accent: string;
  icon: string;
  isLoading: boolean;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="gem-section">
      <div className="gem-section-header">
        <span className="gem-section-icon">{icon}</span>
        <div>
          <h2 className="gem-section-title" style={{ color: accent }}>{title}</h2>
          <p className="gem-section-subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="gem-section-body">
        {isLoading ? (
          <div className="gem-skeleton-list">
            {[...Array(5)].map((_, i) => <div key={i} className="gem-skeleton-row" />)}
          </div>
        ) : empty ? (
          <p className="gem-empty">No qualifying players yet this season.</p>
        ) : children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GemsPage() {
  const navigate = useNavigate();
  const { data: batters = [], isLoading: batLoad }  = useBattingLeaderboard();
  const { data: pitchers = [], isLoading: pitLoad } = usePitchingLeaderboard();
  const { data: fielders = [], isLoading: defLoad } = useDefenseLeaderboard();

  const go = (mlbId: number) => navigate(`/player?id=${mlbId}`);

  // ── 1. Getting Robbed — biggest xwOBA > wOBA gap, min 200 PA ─────────────
  const robbed = useMemo(() =>
    batters
      .filter(b => b.pa >= 200 && b.xwoba > 0 && b.woba > 0)
      .map(b => ({ ...b, gap: b.xwoba - b.woba }))
      .filter(b => b.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8),
    [batters]
  );

  // ── 2. Laser Show — highest barrel%, min 150 PA ───────────────────────────
  const lasers = useMemo(() =>
    batters
      .filter(b => b.pa >= 150 && b.barrelPct > 0)
      .sort((a, b) => b.barrelPct - a.barrelPct)
      .slice(0, 8),
    [batters]
  );

  // ── 3. Toughest Outs — lowest K%, min 200 PA ──────────────────────────────
  const lowK = useMemo(() =>
    batters
      .filter(b => b.pa >= 200 && b.kPct > 0)
      .sort((a, b) => a.kPct - b.kPct)
      .slice(0, 8),
    [batters]
  );

  // ── 4. Better Than ERA — ERA - xFIP > 0.50, min 30 IP ────────────────────
  const eraLuck = useMemo(() =>
    pitchers
      .filter(p => p.ip >= 30 && p.era > 0 && p.xfip > 0)
      .map(p => ({ ...p, gap: p.era - p.xfip }))
      .filter(p => p.gap > 0.5)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 8),
    [pitchers]
  );

  // ── 5. K Machines — highest K%, min 30 IP ────────────────────────────────
  const kMachines = useMemo(() =>
    pitchers
      .filter(p => p.ip >= 30 && p.kPct > 0)
      .sort((a, b) => b.kPct - a.kPct)
      .slice(0, 8),
    [pitchers]
  );

  // ── 6. Invisible Gloves — highest OAA (or Defense), min 300 inn ──────────
  const gloves = useMemo(() => {
    const seen = new Set<number>();
    return fielders
      .filter(f => f.innings >= 300 && f.oaa !== null && f.oaa! > 0)
      .sort((a, b) => (b.oaa ?? 0) - (a.oaa ?? 0))
      .filter(f => {
        if (seen.has(f.mlbId)) return false;
        seen.add(f.mlbId);
        return true;
      })
      .slice(0, 8);
  }, [fielders]);

  return (
    <div className="gems-page">
      <div className="gems-header">
        <h1 className="gems-title">Hidden Gems</h1>
        <p className="gems-subtitle">
          Players who are elite — or getting unlucky — at stats most fans overlook
        </p>
      </div>

      <div className="gems-grid">

        {/* ── Getting Robbed ─────────────────────────────────────────────── */}
        <Section
          title="Getting Robbed"
          subtitle="Biggest gap between expected wOBA (contact quality) and actual wOBA (results). These hitters are performing better than their slash line suggests."
          accent="var(--color-accent)"
          icon="🎰"
          isLoading={batLoad}
          empty={robbed.length === 0}
        >
          {robbed.map((b, i) => (
            <GemRow
              key={b.mlbId}
              rank={i + 1}
              mlbId={b.mlbId}
              name={b.name}
              team={b.team}
              pos={b.pos}
              accentStat={`+${(b.gap * 1000).toFixed(0)}`}
              accentLabel="pts unlucky"
              accentColor="var(--color-accent)"
              stats={[
                { label: 'wOBA', value: dec3(b.woba) },
                { label: 'xwOBA', value: dec3(b.xwoba) },
                { label: 'PA', value: String(b.pa) },
              ]}
              onClick={() => go(b.mlbId)}
            />
          ))}
        </Section>

        {/* ── Laser Show ─────────────────────────────────────────────────── */}
        <Section
          title="Laser Show"
          subtitle="Highest barrel rate. These hitters are making elite contact — not all of it has left the yard yet."
          accent="var(--color-amber)"
          icon="🔥"
          isLoading={batLoad}
          empty={lasers.length === 0}
        >
          {lasers.map((b, i) => (
            <GemRow
              key={b.mlbId}
              rank={i + 1}
              mlbId={b.mlbId}
              name={b.name}
              team={b.team}
              pos={b.pos}
              accentStat={pct1(b.barrelPct)}
              accentLabel="Barrel%"
              accentColor="var(--color-amber)"
              stats={[
                { label: 'Exit Velo', value: b.exitVelo > 0 ? `${b.exitVelo.toFixed(1)}` : '—' },
                { label: 'HR', value: String(b.hr) },
                { label: 'Hard%', value: pct1(b.hardPct) },
              ]}
              onClick={() => go(b.mlbId)}
            />
          ))}
        </Section>

        {/* ── Toughest Outs ──────────────────────────────────────────────── */}
        <Section
          title="Toughest Outs"
          subtitle="Lowest strikeout rate among qualified hitters. These are the hardest batters to put away."
          accent="var(--color-teal)"
          icon="🛡️"
          isLoading={batLoad}
          empty={lowK.length === 0}
        >
          {lowK.map((b, i) => (
            <GemRow
              key={b.mlbId}
              rank={i + 1}
              mlbId={b.mlbId}
              name={b.name}
              team={b.team}
              pos={b.pos}
              accentStat={pct1(b.kPct)}
              accentLabel="K%"
              accentColor="var(--color-teal)"
              stats={[
                { label: 'BB%', value: pct1(b.bbPct) },
                { label: 'AVG', value: dec3(b.avg) },
                { label: 'PA', value: String(b.pa) },
              ]}
              onClick={() => go(b.mlbId)}
            />
          ))}
        </Section>

        {/* ── Better Than ERA ────────────────────────────────────────────── */}
        <Section
          title="Better Than Their ERA"
          subtitle="Biggest ERA minus xFIP gap. The underlying stuff is significantly better than the ERA suggests — results will catch up."
          accent="var(--color-green)"
          icon="📉"
          isLoading={pitLoad}
          empty={eraLuck.length === 0}
        >
          {eraLuck.map((p, i) => (
            <GemRow
              key={p.mlbId}
              rank={i + 1}
              mlbId={p.mlbId}
              name={p.name}
              team={p.team}
              pos={p.pos}
              accentStat={`+${p.gap.toFixed(2)}`}
              accentLabel="ERA − xFIP"
              accentColor="var(--color-green)"
              stats={[
                { label: 'ERA', value: dec2(p.era) },
                { label: 'xFIP', value: dec2(p.xfip) },
                { label: 'IP', value: p.ip.toFixed(1) },
              ]}
              onClick={() => go(p.mlbId)}
            />
          ))}
        </Section>

        {/* ── K Machines ─────────────────────────────────────────────────── */}
        <Section
          title="Strikeout Machines"
          subtitle="Highest strikeout rate among pitchers with 30+ IP. Pure swing-and-miss stuff."
          accent="var(--color-purple)"
          icon="⚡"
          isLoading={pitLoad}
          empty={kMachines.length === 0}
        >
          {kMachines.map((p, i) => (
            <GemRow
              key={p.mlbId}
              rank={i + 1}
              mlbId={p.mlbId}
              name={p.name}
              team={p.team}
              pos={p.pos}
              accentStat={pct1(p.kPct)}
              accentLabel="K%"
              accentColor="var(--color-purple)"
              stats={[
                { label: 'BB%', value: pct1(p.bbPct) },
                { label: 'xFIP', value: dec2(p.xfip) },
                { label: 'IP', value: p.ip.toFixed(1) },
              ]}
              onClick={() => go(p.mlbId)}
            />
          ))}
        </Section>

        {/* ── Invisible Gloves ───────────────────────────────────────────── */}
        <Section
          title="Invisible Gloves"
          subtitle="Highest Outs Above Average among fielders with 300+ innings. Elite defenders who don't always get the credit."
          accent="var(--color-red, #ef4444)"
          icon="🧤"
          isLoading={defLoad}
          empty={gloves.length === 0}
        >
          {gloves.map((f, i) => (
            <GemRow
              key={`${f.mlbId}-${f.pos}`}
              rank={i + 1}
              mlbId={f.mlbId}
              name={f.name}
              team={''}
              pos={f.pos}
              accentStat={f.oaa! >= 0 ? `+${f.oaa}` : String(f.oaa)}
              accentLabel="OAA"
              accentColor="#ef4444"
              stats={[
                { label: 'DRS', value: f.drs !== null ? (f.drs >= 0 ? `+${f.drs}` : String(f.drs)) : '—' },
                { label: 'UZR/150', value: f.uzr150 !== null ? dec2(f.uzr150) : '—' },
                { label: 'Inn', value: String(f.innings) },
              ]}
              onClick={() => go(f.mlbId)}
            />
          ))}
        </Section>

      </div>
    </div>
  );
}
