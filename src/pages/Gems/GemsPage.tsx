import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import TeamLogo, { ABBR_TO_MLB_ID } from '../../components/ui/TeamLogo';
import {
  useBattingLeaderboard,
  usePitchingLeaderboard,
  useDefenseLeaderboard,
  useSavantCustomBatterMap,
  useTeamStandings,
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
  const { data: scBatMap = new Map(), isLoading: scLoad } = useSavantCustomBatterMap();
  const { data: standingsData, isLoading: stdLoad }       = useTeamStandings();

  const go = (mlbId: number) => navigate(`/player?mlbId=${mlbId}`);

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

  // ── 7. Speed Demons — fastest sprint speed (Savant), joined with FG for name/team ──
  const speedsters = useMemo(() => {
    if (!scBatMap.size || !batters.length) return [];
    const fgMap = new Map(batters.map(b => [b.mlbId, b]));
    return [...scBatMap.entries()]
      .map(([mlbId, row]) => {
        const speed = parseFloat(row['sprint_speed'] ?? '0');
        const fg = fgMap.get(mlbId);
        if (!speed || speed < 1 || !fg) return null;
        return { mlbId, speed, name: fg.name, team: fg.team, pos: fg.pos, pa: fg.pa };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null && r.pa >= 100)
      .sort((a, b) => b.speed - a.speed)
      .slice(0, 8);
  }, [scBatMap, batters]);

  // ── 8. Lone Stars — high WAR on a losing team (<.450 win%) ──────────────────
  const loneStars = useMemo(() => {
    if (!standingsData || !batters.length) return [];
    // Build teamId → win% map from standings
    const winPctById = new Map<number, number>();
    for (const div of standingsData.records) {
      for (const tr of div.teamRecords) {
        const total = tr.wins + tr.losses;
        winPctById.set(tr.team.id, total > 0 ? tr.wins / total : 0);
      }
    }
    // Convert FanGraphs abbr → win% via ABBR_TO_MLB_ID
    const getWinPct = (abbr: string) => {
      const id = ABBR_TO_MLB_ID[abbr.toUpperCase()];
      return id ? (winPctById.get(id) ?? null) : null;
    };
    return batters
      .filter(b => {
        if (b.pa < 150 || b.war < 1.0) return false;
        const pct = getWinPct(b.team);
        return pct !== null && pct < 0.450;
      })
      .map(b => ({ ...b, winPct: getWinPct(b.team)! }))
      .sort((a, b) => b.war - a.war)
      .slice(0, 8);
  }, [standingsData, batters]);

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
              team={f.team}
              pos={f.pos}
              accentStat={f.oaa! >= 0 ? `+${f.oaa}` : String(f.oaa)}
              accentLabel="OAA"
              accentColor="#ef4444"
              stats={[
                { label: 'DRS', value: f.drs !== null ? (f.drs >= 0 ? `+${f.drs}` : String(f.drs)) : '—' },
                { label: 'Errors', value: String(f.errors) },
              ]}
              onClick={() => go(f.mlbId)}
            />
          ))}
        </Section>

        {/* ── Speed Demons ───────────────────────────────────────────────── */}
        <Section
          title="Speed Demons"
          subtitle="Fastest sprint speeds per Baseball Savant, min 100 PA. Pure burning-jet-fuel baserunning ability."
          accent="var(--color-amber)"
          icon="💨"
          isLoading={batLoad || scLoad}
          empty={speedsters.length === 0}
        >
          {speedsters.map((s, i) => (
            <GemRow
              key={s.mlbId}
              rank={i + 1}
              mlbId={s.mlbId}
              name={s.name}
              team={s.team}
              pos={s.pos}
              accentStat={`${s.speed.toFixed(1)}`}
              accentLabel="ft/s"
              accentColor="var(--color-amber)"
              stats={[
                { label: 'PA', value: String(s.pa) },
              ]}
              onClick={() => go(s.mlbId)}
            />
          ))}
        </Section>

        {/* ── Lone Stars ─────────────────────────────────────────────────── */}
        <Section
          title="Lone Stars"
          subtitle="Highest WAR among hitters on teams with a win% below .450. Carrying a bad team on their back."
          accent="var(--color-purple)"
          icon="⭐"
          isLoading={batLoad || stdLoad}
          empty={loneStars.length === 0}
        >
          {loneStars.map((b, i) => (
            <GemRow
              key={b.mlbId}
              rank={i + 1}
              mlbId={b.mlbId}
              name={b.name}
              team={b.team}
              pos={b.pos}
              accentStat={b.war >= 0 ? `+${b.war.toFixed(1)}` : b.war.toFixed(1)}
              accentLabel="WAR"
              accentColor="var(--color-purple)"
              stats={[
                { label: 'wRC+', value: String(b.wrcPlus) },
                { label: 'W%', value: `${(b.winPct * 100).toFixed(0)}%` },
                { label: 'PA', value: String(b.pa) },
              ]}
              onClick={() => go(b.mlbId)}
            />
          ))}
        </Section>

      </div>
    </div>
  );
}
