import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, ArrowRight, Zap, Shield,
  ArrowLeftRight, Target, BarChart3, Trophy, Users, Activity,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import PlayerHeadshot from '../../components/ui/PlayerHeadshot';
import { useBattingLeaderboard, usePitchingLeaderboard, useTeamStandings } from '../../hooks/useMLBData';

const YEAR = new Date().getFullYear();

// ─── Tools grid config ────────────────────────────────────────────────

const TOOLS = [
  {
    icon: <Target size={20} />,
    label: 'Player Stats',
    desc: 'Velocity, pitch mix, wOBA, barrel%, spray charts & more',
    path: '/player',
    accent: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'hover:border-sky-400/40',
    tag: 'Analytics',
  },
  {
    icon: <BarChart3 size={20} />,
    label: 'Leaderboard',
    desc: 'Full-season batting & pitching leaders, filterable by team',
    path: '/leaderboard',
    accent: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'hover:border-emerald-400/40',
    tag: 'Leaders',
  },
  {
    icon: <Zap size={20} />,
    label: 'Clutch Analytics',
    desc: 'WPA, RE24, Clutch Score — who rises when it matters most',
    path: '/clutch',
    accent: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'hover:border-amber-400/40',
    tag: 'Pressure',
  },
  {
    icon: <Shield size={20} />,
    label: 'Defense',
    desc: 'OAA, DRS, UZR/150, arm strength and range metrics',
    path: '/defense',
    accent: 'text-teal-400',
    bg: 'bg-teal-400/10',
    border: 'hover:border-teal-400/40',
    tag: 'Defense',
  },
  {
    icon: <Trophy size={20} />,
    label: 'Standings',
    desc: 'Division standings, wild card race and run differential',
    path: '/standings',
    accent: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'hover:border-purple-400/40',
    tag: 'Teams',
  },
  {
    icon: <ArrowLeftRight size={20} />,
    label: 'Trade Analyzer',
    desc: 'Live WAR-based trade builder with age-adjusted fairness meter',
    path: '/trade',
    accent: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'hover:border-rose-400/40',
    tag: 'Flagship',
  },
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
  label, value, sub, color, strokeColor, data,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  strokeColor: string;
  data: { i: number; v: number }[];
}) {
  const gradId = `grad-${strokeColor.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <Card className="relative overflow-hidden border-white/10 bg-white/5 backdrop-blur-sm">
      <CardContent className="pt-4 pb-2 px-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">{label}</p>
        <p className={cn('text-3xl font-bold tabular-nums leading-none mb-0.5', color)}>{value}</p>
        <p className="text-xs text-white/50 mb-2 truncate">{sub}</p>
        <ResponsiveContainer width="100%" height={36}>
          <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={strokeColor} strokeWidth={1.5}
              fill={`url(#${gradId})`} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Rank badge ───────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: 'text-amber-400',
    2: 'text-slate-300',
    3: 'text-orange-400',
  };
  return (
    <span className={cn('w-5 text-center text-[11px] font-bold tabular-nums shrink-0', colors[rank] ?? 'text-muted-foreground')}>
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
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 border border-white/8 px-8 py-10 md:px-12 md:py-14">
        {/* Background glow blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-10 h-48 w-80 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative grid grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
          {/* Left: copy */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]" />
              {YEAR} MLB Season · Live Data
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
              Front-Office Grade<br />
              <span className="bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">
                Baseball Intelligence
              </span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
              Advanced analytics powered by live FanGraphs and MLB Stats API.
              Explore player stats, simulate trades, track clutch performance,
              and generate actionable front-office insights.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-sky-400 hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(56,189,248,0.4)]"
              >
                View Leaderboard <ArrowRight size={15} />
              </Link>
              <Link
                to="/trade"
                className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:border-white/25"
              >
                Trade Analyzer
              </Link>
            </div>
          </div>

          {/* Right: live metric cards */}
          <div className="flex flex-col gap-3">
            {batLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-white/30">
                Loading live stats…
              </div>
            ) : (
              <>
                <HeroMetricCard
                  label={`wOBA Leader · ${YEAR}`}
                  value={wobaLeader ? wobaLeader.woba.toFixed(3) : '—'}
                  sub={wobaLeader ? `${wobaLeader.name} · ${wobaLeader.team}` : 'Loading…'}
                  color="text-sky-400"
                  strokeColor="#38bdf8"
                  data={sparkWoba}
                />
                <HeroMetricCard
                  label={`WPA Leader · ${YEAR}`}
                  value={wpaLeader ? `+${wpaLeader.wpa.toFixed(2)}` : '—'}
                  sub={wpaLeader ? `${wpaLeader.name} · ${wpaLeader.team}` : 'Loading…'}
                  color="text-emerald-400"
                  strokeColor="#34d399"
                  data={sparkWpa}
                />
                <HeroMetricCard
                  label={`WAR Leader · ${YEAR}`}
                  value={warLeader ? warLeader.war.toFixed(1) : '—'}
                  sub={warLeader ? `${warLeader.name} · ${warLeader.team}` : 'Loading…'}
                  color="text-purple-400"
                  strokeColor="#a78bfa"
                  data={sparkWar}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Quick stats strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Qualified Batters',  value: batLoading ? '…' : String(totalBatters),  icon: <Users size={16} />,    color: 'text-sky-400'    },
          { label: 'Qualified Pitchers', value: batLoading ? '…' : String(totalPitchers), icon: <Activity size={16} />, color: 'text-emerald-400' },
          { label: 'MLB Teams',          value: String(totalTeams),                        icon: <Shield size={16} />,   color: 'text-purple-400' },
          { label: 'Analytics Tools',    value: '6',                                       icon: <Trophy size={16} />,   color: 'text-amber-400'  },
        ].map(s => (
          <Card key={s.label} className="flex-row items-center gap-3 p-4">
            <div className={cn('shrink-0 rounded-lg p-2', s.color, 'bg-current/10')}>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums leading-none">{s.value}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Analytics Suite ───────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Analytics Suite</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Six powerful tools built for the modern front office</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(tool => (
            <Link key={tool.path} to={tool.path} className="group block no-underline">
              <Card className={cn('h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', tool.border)}>
                <CardContent className="flex flex-col gap-3 pt-5 pb-5">
                  <div className="flex items-start justify-between">
                    <div className={cn('rounded-lg p-2.5', tool.bg, tool.accent)}>
                      {tool.icon}
                    </div>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', tool.bg, tool.accent)}>
                      {tool.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">{tool.label}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tool.desc}</p>
                  </div>
                  <div className={cn('mt-auto flex items-center gap-1 text-xs font-semibold transition-all', tool.accent)}>
                    Explore
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ── WPA Risers / Watchers ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Risers */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">WPA Risers 🔥</CardTitle>
                <CardDescription className="text-xs">Highest Win Probability Added · {YEAR}</CardDescription>
              </div>
              <Link to="/clutch" className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                See all <ArrowRight size={11} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-2">
            {batLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="flex flex-col divide-y divide-border/40">
                {wpaRisers.map((r, i) => (
                  <Link key={r.mlbId} to="/clutch" className="group flex items-center gap-3 py-2.5 no-underline hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors">
                    <RankBadge rank={i + 1} />
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      <PlayerHeadshot mlbId={r.mlbId} size={32} alt={r.name} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold leading-tight">{r.name}</span>
                      <span className="text-[11px] text-muted-foreground">{r.pos} · {r.team}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[13px] font-bold tabular-nums text-emerald-400">+{r.wpa.toFixed(2)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">WPA</span>
                    </div>
                    <div className="ml-1 flex items-center gap-0.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      <TrendingUp size={10} />{r.wrcPlus}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Watch List */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">Watch List 📉</CardTitle>
                <CardDescription className="text-xs">Lowest Win Probability Added · {YEAR}</CardDescription>
              </div>
              <Link to="/clutch" className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                See all <ArrowRight size={11} />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3 pb-2">
            {batLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="flex flex-col divide-y divide-border/40">
                {wpaWatchers.map((r, i) => (
                  <Link key={r.mlbId} to="/clutch" className="group flex items-center gap-3 py-2.5 no-underline hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors">
                    <RankBadge rank={i + 1} />
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted">
                      <PlayerHeadshot mlbId={r.mlbId} size={32} alt={r.name} />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13px] font-semibold leading-tight">{r.name}</span>
                      <span className="text-[11px] text-muted-foreground">{r.pos} · {r.team}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[13px] font-bold tabular-nums text-rose-400">{r.wpa.toFixed(2)}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">WPA</span>
                    </div>
                    <div className="ml-1 flex items-center gap-0.5 rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                      <TrendingDown size={10} />{r.wrcPlus}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── WAR Leaders ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">WAR Leaders · {YEAR}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Top performers by Wins Above Replacement — batters &amp; pitchers combined</p>
          </div>
          <Link to="/leaderboard" className="flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-all hover:gap-1.5">
            Full leaderboard <ArrowRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {batLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-[72px] pt-4" />
                </Card>
              ))
            : warLeaders.map((p, i) => (
                <Link key={p.mlbId} to="/leaderboard" className="group block no-underline">
                  <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-white/15">
                    <CardContent className="flex items-center gap-3 pt-4 pb-4">
                      <RankBadge rank={i + 1} />
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted">
                        <PlayerHeadshot mlbId={p.mlbId} size={44} alt={p.name} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold leading-tight">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground">{p.pos} · {p.team}</span>
                        {/* WAR progress bar */}
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-500"
                            style={{ width: `${Math.min((p.war / (warLeaders[0]?.war ?? 8)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <span className="text-xl font-bold tabular-nums text-sky-400 leading-none">{p.war.toFixed(1)}</span>
                        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">WAR</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
          }
        </div>
      </section>

    </div>
  );
}
