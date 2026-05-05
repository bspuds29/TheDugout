import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, ArrowRight, Zap, Shield,
  ArrowLeftRight, Target, BarChart3, Trophy, Users, Activity,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useBattingLeaderboard, usePitchingLeaderboard, useTeamStandings } from '../../hooks/useMLBData';
import PlayerHeadshot from '../../components/ui/PlayerHeadshot';

const YEAR = new Date().getFullYear();

// ─── Tools ───────────────────────────────────────────────────────────

const TOOLS = [
  { icon: <Target size={20} />,         label: 'Player Stats',     desc: 'Velocity, pitch mix, wOBA, barrel%, spray charts & more',      path: '/player',      accent: '#20b2ff', bg: 'rgba(32,178,255,0.12)',  tag: 'Analytics' },
  { icon: <BarChart3 size={20} />,      label: 'Leaderboard',      desc: 'Full-season batting & pitching leaders, filterable by team',   path: '/leaderboard', accent: '#22c55e', bg: 'rgba(34,197,94,0.12)',   tag: 'Leaders'   },
  { icon: <Zap size={20} />,            label: 'Clutch Analytics', desc: 'WPA, RE24, Clutch Score — who rises when it matters most',     path: '/clutch',      accent: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  tag: 'Pressure'  },
  { icon: <Shield size={20} />,         label: 'Defense',          desc: 'OAA, DRS, UZR/150, arm strength and range metrics',           path: '/defense',     accent: '#00d4aa', bg: 'rgba(0,212,170,0.12)',   tag: 'Defense'   },
  { icon: <Trophy size={20} />,         label: 'Standings',        desc: 'Division standings, wild card race and run differential',      path: '/standings',   accent: '#a855f7', bg: 'rgba(168,85,247,0.12)',  tag: 'Teams'     },
  { icon: <ArrowLeftRight size={20} />, label: 'Trade Analyzer',   desc: 'Live WAR-based trade builder with age-adjusted fairness meter',path: '/trade',       accent: '#ef4444', bg: 'rgba(239,68,68,0.12)',   tag: 'Flagship'  },
];

// ─── Sparkline helpers ────────────────────────────────────────────────

function seededRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}
function spark(base: number, amp: number, seed: number, n = 14) {
  const rng = seededRng(seed);
  return Array.from({ length: n }, (_, i) => ({
    i,
    v: base + Math.sin(i / 1.8) * amp * 0.7 + (rng() - 0.5) * amp,
  }));
}

// ─── Inline sparkline ─────────────────────────────────────────────────

function Sparkline({ data, color }: { data: { i: number; v: number }[]; color: string }) {
  const id = `sg-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <div style={{ width: 260, height: 80, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: 6, bottom: 8 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5}
            fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hero metric row ──────────────────────────────────────────────────

function MetricRow({
  label, value, name, color, data, noBorder,
}: { label: string; value: string; name: string; color: string; data: { i: number; v: number }[]; noBorder?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 0',
      borderBottom: noBorder ? 'none' : '1px solid var(--color-border)',
    }}>
      {/* Left: label + value + name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>{value}</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
      </div>
      {/* Right: sparkline */}
      <div style={{ flexShrink: 0 }}>
        <Sparkline data={data} color={color} />
      </div>
    </div>
  );
}

// ─── Rank badge ───────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const color = rank === 1 ? 'var(--color-amber)' : rank === 2 ? 'var(--color-text-secondary)' : rank === 3 ? '#c77c40' : 'var(--color-text-muted)';
  return <span style={{ width: 20, textAlign: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color, flexShrink: 0 }}>{rank}</span>;
}

// ─── Shared card style ────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-xl)',
};

// ─── Main page ────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: batters = [], isLoading: batLoading } = useBattingLeaderboard();
  const { data: pitchers = [] }                       = usePitchingLeaderboard();
  const { data: standings }                           = useTeamStandings(YEAR);

  const qualBat = useMemo(() => batters.filter(r => r.pa  >= 50), [batters]);
  const qualPit = useMemo(() => pitchers.filter(r => r.ip >= 20), [pitchers]);

  const wobaLeader = useMemo(() => [...qualBat].sort((a, b) => b.woba - a.woba)[0], [qualBat]);
  const wpaLeader  = useMemo(() => [...qualBat].sort((a, b) => b.wpa  - a.wpa)[0],  [qualBat]);
  const warLeaderB = useMemo(() => [...qualBat].sort((a, b) => b.war  - a.war)[0],  [qualBat]);
  const warLeaderP = useMemo(() => [...qualPit].sort((a, b) => b.war  - a.war)[0],  [qualPit]);
  const warLeader  = (!warLeaderB || (warLeaderP && warLeaderP.war > warLeaderB.war)) ? warLeaderP : warLeaderB;

  const wpaRisers   = useMemo(() => [...qualBat].sort((a, b) => b.wpa - a.wpa).slice(0, 5), [qualBat]);
  const wpaWatchers = useMemo(() => [...qualBat].sort((a, b) => a.wpa - b.wpa).slice(0, 5), [qualBat]);

  const warLeaders = useMemo(() => {
    const all = [
      ...qualBat.map(r => ({ mlbId: r.mlbId, name: r.name, team: r.team, pos: r.pos, war: r.war })),
      ...qualPit.map(r => ({ mlbId: r.mlbId, name: r.name, team: r.team, pos: r.pos, war: r.war })),
    ];
    return all.sort((a, b) => b.war - a.war).slice(0, 6);
  }, [qualBat, qualPit]);

  const totalTeams    = standings?.records
    ? standings.records.reduce((n: number, r: { teamRecords?: unknown[] }) => n + (r.teamRecords?.length ?? 0), 0) || 30
    : 30;

  const sparkWoba = useMemo(() => spark(wobaLeader?.woba ?? 0.38, 0.04,  wobaLeader?.mlbId ?? 1), [wobaLeader]);
  const sparkWpa  = useMemo(() => spark(wpaLeader?.wpa   ?? 1.5,  0.6,   wpaLeader?.mlbId  ?? 2), [wpaLeader]);
  const sparkWar  = useMemo(() => spark(warLeader?.war   ?? 3.0,  0.5,   warLeader?.mlbId  ?? 3), [warLeader]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{
        ...cardStyle,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-8)',
        padding: 'var(--space-8) var(--space-10)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--color-accent) 0%, var(--color-teal) 60%, transparent 100%)' }} />
        {/* Glow blob */}
        <div style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(32,178,255,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--color-accent-dim)', border: '1px solid rgba(32,178,255,0.2)', borderRadius: 'var(--radius-full)', padding: '4px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent)', marginBottom: 'var(--space-4)', alignSelf: 'flex-start' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-green)', boxShadow: '0 0 6px var(--color-green)', flexShrink: 0 }} />
            {YEAR} MLB Season · Live Data
          </div>
          <h1 style={{ fontSize: 'clamp(30px,3.5vw,48px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', color: 'var(--color-text-primary)', marginBottom: 'var(--space-3)' }}>
            Front-Office Grade<br />
            <span style={{ background: 'linear-gradient(90deg, var(--color-accent), var(--color-teal))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Baseball Intelligence
            </span>
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, maxWidth: 400, marginBottom: 'var(--space-6)' }}>
            Advanced analytics powered by live FanGraphs and MLB Stats API.
            Explore player stats, simulate trades, track clutch performance,
            and generate front-office insights.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Link to="/leaderboard" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-lg)', fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all var(--transition-base)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-accent-bright)'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-accent)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              View Leaderboard <ArrowRight size={15} />
            </Link>
            <Link to="/trade" style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', borderRadius: 'var(--radius-lg)', fontSize: 14, fontWeight: 600, textDecoration: 'none', transition: 'all var(--transition-fast)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-active)'; e.currentTarget.style.background = 'var(--color-bg-card-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg-elevated)'; }}>
              Trade Analyzer
            </Link>
          </div>
        </div>

        {/* Right: live metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {batLoading ? (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: 'var(--space-8) 0', textAlign: 'center' }}>Loading live stats…</div>
          ) : (
            <>
              <MetricRow label={`wOBA Leader · ${YEAR}`} value={wobaLeader?.woba.toFixed(3) ?? '—'} name={wobaLeader ? `${wobaLeader.name} · ${wobaLeader.team}` : '—'} color="var(--color-accent)" data={sparkWoba} />
              <MetricRow label={`WPA Leader · ${YEAR}`}  value={wpaLeader ? `+${wpaLeader.wpa.toFixed(2)}` : '—'} name={wpaLeader ? `${wpaLeader.name} · ${wpaLeader.team}` : '—'} color="var(--color-teal)" data={sparkWpa} />
              <MetricRow label={`WAR Leader · ${YEAR}`}  value={warLeader?.war.toFixed(1) ?? '—'} name={warLeader ? `${warLeader.name} · ${warLeader.team}` : '—'} color="var(--color-purple)" data={sparkWar} noBorder />
            </>
          )}
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: 'var(--space-5) var(--space-6)' }}>
        {[
          { label: 'Qualified Batters',  value: batLoading ? '…' : String(qualBat.length),  icon: <Users size={18} />,    color: 'var(--color-accent)',  bg: 'var(--color-accent-dim)'  },
          { label: 'Qualified Pitchers', value: batLoading ? '…' : String(qualPit.length),  icon: <Activity size={18} />, color: 'var(--color-green)',   bg: 'var(--color-green-dim)'   },
          { label: 'MLB Teams',          value: String(totalTeams),                          icon: <Shield size={18} />,   color: 'var(--color-purple)',  bg: 'var(--color-purple-dim)'  },
          { label: 'Analytics Tools',    value: '6',                                         icon: <Trophy size={18} />,   color: 'var(--color-amber)',   bg: 'var(--color-amber-dim)'   },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Analytics Suite ───────────────────────────────────────────── */}
      <section>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>Analytics Suite</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 3 }}>Six powerful tools built for the modern front office</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {TOOLS.map(tool => (
            <Link key={tool.path} to={tool.path}
              className="tool-card-new"
              style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-4)', textDecoration: 'none', transition: 'all var(--transition-base)', borderRadius: 'var(--radius-xl)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: tool.bg, color: tool.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {tool.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', background: tool.bg, color: tool.accent, borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
                  {tool.tag}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{tool.label}</h3>
                <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginTop: 3 }}>{tool.desc}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Explore <ArrowRight size={11} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── WPA Risers / Watchers ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
        {[
          { title: 'WPA Risers 🔥', sub: `Highest Win Probability Added · ${YEAR}`, players: wpaRisers,   up: true  },
          { title: 'Watch List 📉', sub: `Lowest Win Probability Added · ${YEAR}`,  players: wpaWatchers, up: false },
        ].map(({ title, sub, players, up }) => (
          <div key={title} style={cardStyle}>
            <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-primary)' }}>{title}</h3>
                <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{sub}</p>
              </div>
              <Link to="/clutch" style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>See all <ArrowRight size={11} /></Link>
            </div>
            <div style={{ padding: 'var(--space-2)' }}>
              {batLoading ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</div>
              ) : players.map((r, i) => (
                <Link key={r.mlbId} to="/clutch"
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) var(--space-2)', borderRadius: 'var(--radius-md)', textDecoration: 'none', transition: 'background var(--transition-fast)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <RankBadge rank={i + 1} />
                  <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg-elevated)' }}>
                    <PlayerHeadshot mlbId={r.mlbId} size={32} alt={r.name} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{r.pos} · {r.team}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: up ? 'var(--color-green)' : 'var(--color-red)' }}>{up ? '+' : ''}{r.wpa.toFixed(2)}</div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>WPA</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)', background: up ? 'var(--color-green-dim)' : 'var(--color-red-dim)', color: up ? 'var(--color-green)' : 'var(--color-red)', borderRadius: 'var(--radius-full)', padding: '2px 7px', marginLeft: 4 }}>
                    {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{r.wrcPlus}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── WAR Leaders ───────────────────────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)' }}>WAR Leaders · {YEAR}</h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 3 }}>Top performers by Wins Above Replacement — batters &amp; pitchers combined</p>
          </div>
          <Link to="/leaderboard" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--color-accent)', transition: 'gap var(--transition-fast)' }}>
            Full leaderboard <ArrowRight size={13} />
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
          {batLoading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ ...cardStyle, height: 72, animation: 'pulse 1.4s ease-in-out infinite' }} />)
            : warLeaders.map((p, i) => (
                <Link key={p.mlbId} to="/leaderboard"
                  style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', textDecoration: 'none', transition: 'all var(--transition-fast)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-hover)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.transform = 'none'; }}>
                  <RankBadge rank={i + 1} />
                  <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--color-bg-elevated)' }}>
                    <PlayerHeadshot mlbId={p.mlbId} size={44} alt={p.name} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{p.pos} · {p.team}</div>
                    <div style={{ marginTop: 6, height: 3, background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((p.war / (warLeaders[0]?.war ?? 8)) * 100, 100)}%`, background: 'linear-gradient(90deg, var(--color-accent), var(--color-teal))', borderRadius: 'var(--radius-full)', transition: 'width 600ms ease' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', lineHeight: 1 }}>{p.war.toFixed(1)}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginTop: 2 }}>WAR</div>
                  </div>
                </Link>
              ))
          }
        </div>
      </section>

    </div>
  );
}
