import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, ArrowRight, Zap, Shield,
  ArrowLeftRight, Target, BarChart3, Trophy, Users, Activity,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import PlayerHeadshot from '../../components/ui/PlayerHeadshot';
import { useBattingLeaderboard, usePitchingLeaderboard, useTeamStandings } from '../../hooks/useMLBData';

const YEAR = new Date().getFullYear();

// ─── Tools grid config ────────────────────────────────────────────────

const TOOLS = [
  { icon: <Target size={20} />,          label: 'Player Stats',     desc: 'Velocity, pitch mix, wOBA, barrel%, spray charts & more',      path: '/player',      accentVar: '--color-accent',  bgVar: '--color-accent-dim',  tag: 'Analytics' },
  { icon: <BarChart3 size={20} />,       label: 'Leaderboard',      desc: 'Full-season batting & pitching leaders, filterable by team',   path: '/leaderboard', accentVar: '--color-green',   bgVar: '--color-green-dim',   tag: 'Leaders'   },
  { icon: <Zap size={20} />,             label: 'Clutch Analytics', desc: 'WPA, RE24, Clutch Score — who rises when it matters most',     path: '/clutch',      accentVar: '--color-amber',   bgVar: '--color-amber-dim',   tag: 'Pressure'  },
  { icon: <Shield size={20} />,          label: 'Defense',          desc: 'OAA, DRS, UZR/150, arm strength and range metrics',           path: '/defense',     accentVar: '--color-teal',    bgVar: '--color-teal-dim',    tag: 'Defense'   },
  { icon: <Trophy size={20} />,          label: 'Standings',        desc: 'Division standings, wild card race and run differential',      path: '/standings',   accentVar: '--color-purple',  bgVar: '--color-purple-dim',  tag: 'Teams'     },
  { icon: <ArrowLeftRight size={20} />,  label: 'Trade Analyzer',   desc: 'Live WAR-based trade builder with age-adjusted fairness meter',path: '/trade',       accentVar: '--color-red',     bgVar: '--color-red-dim',     tag: 'Flagship'  },
];

// ─── Sparkline helpers ────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function spark(base: number, amp: number, seed: number, n = 12) {
  const rng = seededRng(seed);
  return Array.from({ length: n }, (_, i) => ({
    i,
    v: base + Math.sin(i / 2) * amp + (rng() - 0.5) * amp * 0.5,
  }));
}

// ─── Hero metric card ─────────────────────────────────────────────────

function HeroMetricCard({
  label, value, sub, accentVar, data,
}: {
  label: string;
  value: string;
  sub: string;
  accentVar: string;
  data: { i: number; v: number }[];
}) {
  const gradId = `grad-${accentVar.replace(/[^a-z]/g, '')}`;
  const color = `var(${accentVar})`;
  return (
    <div
      className="rounded-xl px-4 pt-3 pb-2 transition-colors"
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1"
         style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
      <p className="text-[28px] font-bold tabular-nums leading-none mb-0.5"
         style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</p>
      <p className="text-xs mb-2 truncate" style={{ color: 'var(--color-text-secondary)' }}>{sub}</p>
      <ResponsiveContainer width="100%" height={34}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
            fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Rank badge ───────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const color = rank === 1 ? 'var(--color-amber)' : rank === 2 ? 'var(--color-text-secondary)' : rank === 3 ? '#c77c40' : 'var(--color-text-muted)';
  return (
    <span className="w-5 text-center text-[11px] font-bold tabular-nums shrink-0"
          style={{ color, fontFamily: 'var(--font-mono)' }}>
      {rank}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: batters = [], isLoading: batLoading } = useBattingLeaderboard();
  const { data: pitchers = [] }                       = usePitchingLeaderboard();
  const { data: standings }                           = useTeamStandings(YEAR);

  const qualBat = useMemo(() => batters.filter(r => r.pa  >= 50), [batters]);
  const qualPit = useMemo(() => pitchers.filter(r => r.ip >= 20), [pitchers]);

  const wobaLeader = useMemo(() => [...qualBat].sort((a, b) => b.woba - a.woba)[0],  [qualBat]);
  const wpaLeader  = useMemo(() => [...qualBat].sort((a, b) => b.wpa  - a.wpa)[0],   [qualBat]);
  const warLeaderB = useMemo(() => [...qualBat].sort((a, b) => b.war  - a.war)[0],   [qualBat]);
  const warLeaderP = useMemo(() => [...qualPit].sort((a, b) => b.war  - a.war)[0],   [qualPit]);
  const warLeader  = (!warLeaderB || (warLeaderP && warLeaderP.war > warLeaderB.war)) ? warLeaderP : warLeaderB;

  const wpaRisers   = useMemo(() => [...qualBat].sort((a, b) => b.wpa - a.wpa).slice(0, 5), [qualBat]);
  const wpaWatchers = useMemo(() => [...qualBat].sort((a, b) => a.wpa - b.wpa).slice(0, 5), [qualBat]);

  const warLeaders = useMemo(() => {
    const combined = [
      ...qualBat.map(r => ({ mlbId: r.mlbId, name: r.name, team: r.team, pos: r.pos, war: r.war, type: 'bat' as const })),
      ...qualPit.map(r => ({ mlbId: r.mlbId, name: r.name, team: r.team, pos: r.pos, war: r.war, type: 'pit' as const })),
    ];
    return combined.sort((a, b) => b.war - a.war).slice(0, 6);
  }, [qualBat, qualPit]);

  const totalTeams    = standings?.records
    ? standings.records.reduce((n: number, r: { teamRecords?: unknown[] }) => n + (r.teamRecords?.length ?? 0), 0) || 30
    : 30;
  const totalBatters  = qualBat.length;
  const totalPitchers = qualPit.length;

  const sparkWoba = useMemo(() => spark(wobaLeader?.woba ?? 0.38, 0.008, wobaLeader?.mlbId ?? 1), [wobaLeader]);
  const sparkWpa  = useMemo(() => spark(wpaLeader?.wpa   ?? 1.5,  0.15,  wpaLeader?.mlbId  ?? 2), [wpaLeader]);
  const sparkWar  = useMemo(() => spark(warLeader?.war   ?? 3.0,  0.2,   warLeader?.mlbId  ?? 3), [warLeader]);

  return (
    <div className="flex flex-col gap-10">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-2xl grid grid-cols-1 gap-10 px-8 py-10 md:grid-cols-2 md:items-center md:px-12 md:py-12"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 0 60px rgba(32, 178, 255, 0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-teal), transparent)' }} />
        {/* Subtle corner glow */}
        <div className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(32,178,255,0.08) 0%, transparent 70%)' }} />

        {/* Left: copy */}
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
               style={{ background: 'var(--color-accent-dim)', color: 'var(--color-accent)', border: '1px solid rgba(32,178,255,0.2)' }}>
            <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--color-green)', boxShadow: '0 0 6px var(--color-green)' }} />
            {YEAR} MLB Season · Live Data
          </div>
          <h1 className="text-[clamp(32px,4vw,52px)] font-extrabold leading-[1.1] tracking-tight mb-4"
              style={{ color: 'var(--color-text-primary)' }}>
            Front-Office Grade<br />
            <span style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-teal))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Baseball Intelligence
            </span>
          </h1>
          <p className="text-[15px] leading-relaxed max-w-md mb-7"
             style={{ color: 'var(--color-text-secondary)' }}>
            Advanced analytics powered by live FanGraphs and MLB Stats API.
            Explore player stats, simulate trades, track clutch performance,
            and generate actionable front-office insights.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/leaderboard"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-px"
              style={{ background: 'var(--color-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent-bright)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-accent)')}>
              View Leaderboard <ArrowRight size={15} />
            </Link>
            <Link to="/trade"
              className="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-semibold transition-all"
              style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>
              Trade Analyzer
            </Link>
          </div>
        </div>

        {/* Right: live metric cards */}
        <div className="flex flex-col gap-3">
          {batLoading ? (
            <div className="flex h-36 items-center justify-center text-sm"
                 style={{ color: 'var(--color-text-muted)' }}>Loading live stats…</div>
          ) : (
            <>
              <HeroMetricCard label={`wOBA Leader · ${YEAR}`}
                value={wobaLeader ? wobaLeader.woba.toFixed(3) : '—'}
                sub={wobaLeader ? `${wobaLeader.name} · ${wobaLeader.team}` : 'Loading…'}
                accentVar="--color-accent" data={sparkWoba} />
              <HeroMetricCard label={`WPA Leader · ${YEAR}`}
                value={wpaLeader ? `+${wpaLeader.wpa.toFixed(2)}` : '—'}
                sub={wpaLeader ? `${wpaLeader.name} · ${wpaLeader.team}` : 'Loading…'}
                accentVar="--color-teal" data={sparkWpa} />
              <HeroMetricCard label={`WAR Leader · ${YEAR}`}
                value={warLeader ? warLeader.war.toFixed(1) : '—'}
                sub={warLeader ? `${warLeader.name} · ${warLeader.team}` : 'Loading…'}
                accentVar="--color-purple" data={sparkWar} />
            </>
          )}
        </div>
      </section>

      {/* ── Quick stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"
           style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
        {[
          { label: 'Qualified Batters',  value: batLoading ? '…' : String(totalBatters),  icon: <Users size={18} />,    accentVar: '--color-accent'  },
          { label: 'Qualified Pitchers', value: batLoading ? '…' : String(totalPitchers), icon: <Activity size={18} />, accentVar: '--color-green'   },
          { label: 'MLB Teams',          value: String(totalTeams),                        icon: <Shield size={18} />,   accentVar: '--color-purple'  },
          { label: 'Analytics Tools',    value: '6',                                       icon: <Trophy size={18} />,   accentVar: '--color-amber'   },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                 style={{ background: `var(${s.accentVar}-dim)`, color: `var(${s.accentVar})` }}>
              {s.icon}
            </div>
            <div>
              <p className="text-[22px] font-bold leading-none tabular-nums"
                 style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{s.value}</p>
              <p className="text-[11px] uppercase tracking-wide mt-0.5"
                 style={{ color: 'var(--color-text-tertiary)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics Suite ───────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Analytics Suite</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Six powerful tools built for the modern front office</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(tool => (
            <Link key={tool.path} to={tool.path}
              className="group flex flex-col gap-3 rounded-xl p-5 no-underline transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-hover)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-lg flex items-center justify-center"
                     style={{ background: `var(${tool.bgVar})`, color: `var(${tool.accentVar})` }}>
                  {tool.icon}
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: `var(${tool.bgVar})`, color: `var(${tool.accentVar})` }}>
                  {tool.tag}
                </span>
              </div>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{tool.label}</h3>
                <p className="text-[12.5px] leading-relaxed mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{tool.desc}</p>
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-xs font-semibold transition-all"
                   style={{ color: 'var(--color-text-muted)' }}>
                Explore
                <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── WPA Risers / Watchers ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { title: 'WPA Risers 🔥', subtitle: `Highest Win Probability Added · ${YEAR}`, players: wpaRisers,   up: true  },
          { title: 'Watch List 📉', subtitle: `Lowest Win Probability Added · ${YEAR}`,  players: wpaWatchers, up: false },
        ].map(({ title, subtitle, players, up }) => (
          <div key={title} className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-3"
                 style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{subtitle}</p>
              </div>
              <Link to="/clutch"
                className="flex items-center gap-1 text-[11px] font-semibold no-underline"
                style={{ color: 'var(--color-accent)' }}>
                See all <ArrowRight size={11} />
              </Link>
            </div>
            {/* Rows */}
            <div className="flex flex-col px-2 py-2">
              {batLoading ? (
                <div className="py-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
              ) : players.map((r, i) => (
                <Link key={r.mlbId} to="/clutch"
                  className="flex items-center gap-3 rounded-lg px-2 py-2 no-underline transition-colors"
                  style={{}}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <RankBadge rank={i + 1} />
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
                       style={{ background: 'var(--color-bg-elevated)' }}>
                    <PlayerHeadshot mlbId={r.mlbId} size={32} alt={r.name} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold leading-tight"
                          style={{ color: 'var(--color-text-primary)' }}>{r.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{r.pos} · {r.team}</span>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[13px] font-bold tabular-nums"
                          style={{ color: up ? 'var(--color-green)' : 'var(--color-red)', fontFamily: 'var(--font-mono)' }}>
                      {up ? '+' : ''}{r.wpa.toFixed(2)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>WPA</span>
                  </div>
                  <div className="ml-1 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold"
                       style={{ background: up ? 'var(--color-green-dim)' : 'var(--color-red-dim)', color: up ? 'var(--color-green)' : 'var(--color-red)' }}>
                    {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{r.wrcPlus}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── WAR Leaders ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>WAR Leaders · {YEAR}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
              Top performers by Wins Above Replacement — batters &amp; pitchers combined
            </p>
          </div>
          <Link to="/leaderboard"
            className="flex items-center gap-1 text-xs font-semibold no-underline transition-all hover:gap-1.5"
            style={{ color: 'var(--color-accent)' }}>
            Full leaderboard <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg h-[72px] animate-pulse"
                     style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }} />
              ))
            : warLeaders.map((p, i) => (
                <Link key={p.mlbId} to="/leaderboard"
                  className="group flex items-center gap-3 rounded-lg p-4 no-underline transition-all duration-150 hover:-translate-y-px"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}>
                  <RankBadge rank={i + 1} />
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full"
                       style={{ background: 'var(--color-bg-elevated)' }}>
                    <PlayerHeadshot mlbId={p.mlbId} size={44} alt={p.name} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold leading-tight"
                          style={{ color: 'var(--color-text-primary)' }}>{p.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>{p.pos} · {p.team}</span>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full"
                         style={{ background: 'var(--color-bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                           style={{
                             width: `${Math.min((p.war / (warLeaders[0]?.war ?? 8)) * 100, 100)}%`,
                             background: 'linear-gradient(90deg, var(--color-accent), var(--color-teal))',
                           }} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-xl font-bold leading-none"
                          style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>{p.war.toFixed(1)}</span>
                    <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest"
                          style={{ color: 'var(--color-text-muted)' }}>WAR</span>
                  </div>
                </Link>
              ))
          }
        </div>
      </section>

    </div>
  );
}
