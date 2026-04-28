import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, ArrowRight, Zap, Shield,
  ArrowLeftRight, Wrench, Target, BarChart3, Trophy, Users, Activity,
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import PlayerHeadshot from '../../components/ui/PlayerHeadshot';
import TeamLogo from '../../components/ui/TeamLogo';
import { useBattingLeaderboard, usePitchingLeaderboard, useTeamStandings } from '../../hooks/useMLBData';
import './HomePage.css';

const YEAR = new Date().getFullYear();

// ─── Tools grid config ────────────────────────────────────────────────

const TOOLS = [
  { icon: <Target size={22} />,       label: 'Player Stats',      desc: 'Velocity, pitch mix, wOBA, barrel%, spray charts & more',      path: '/player',     color: 'accent',  tag: 'Analytics' },
  { icon: <BarChart3 size={22} />,    label: 'Leaderboard',       desc: 'Full-season batting & pitching leaders, filterable by team',    path: '/leaderboard',color: 'green',   tag: 'Leaders'   },
  { icon: <Zap size={22} />,          label: 'Clutch Analytics',  desc: 'WPA, RE24, Clutch Score — who rises when it matters most',      path: '/clutch',     color: 'amber',   tag: 'Pressure'  },
  { icon: <Shield size={22} />,       label: 'Defense',           desc: 'OAA, DRS, UZR/150, arm strength and range metrics',            path: '/defense',    color: 'teal',    tag: 'Defense'   },
  { icon: <Trophy size={22} />,       label: 'Standings',         desc: 'Division standings, wild card race and run differential',       path: '/standings',  color: 'purple',  tag: 'Teams'     },
  { icon: <ArrowLeftRight size={22} />,label:'Trade Analyzer',    desc: 'Live WAR-based trade builder with age-adjusted fairness meter', path: '/trade',      color: 'red',     tag: 'Flagship'  },
];

// ─── Sparkline data (deterministic — seeded by player mlbId) ─────────
//
// Previously used Math.random() which re-rolled on every render.
// Now keyed on the player's MLB ID so the shape is unique per player
// and stable across re-renders.

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
  label, value, sub, color, data,
}: { label: string; value: string; sub: string; color: string; data: { i: number; v: number }[] }) {
  return (
    <div className="hero-metric-card">
      <span className="hero-metric-label">{label}</span>
      <span className="hero-metric-value" style={{ color }}>{value}</span>
      <span className="hero-metric-name">{sub}</span>
      <ResponsiveContainer width="100%" height={38}>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`hg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0}   />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
            fill={`url(#hg-${color.replace('#', '')})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: batters = [], isLoading: batLoading } = useBattingLeaderboard();
  const { data: pitchers = [] }                       = usePitchingLeaderboard();
  const { data: standings }                           = useTeamStandings(YEAR);

  // Qualified leaderboard subsets
  const qualBat = useMemo(() => batters.filter(r => r.pa  >= 50),  [batters]);
  const qualPit = useMemo(() => pitchers.filter(r => r.ip >= 20),  [pitchers]);

  // Hero stat leaders
  const wobaLeader  = useMemo(() => [...qualBat].sort((a, b) => b.woba   - a.woba)[0],   [qualBat]);
  const wpaLeader   = useMemo(() => [...qualBat].sort((a, b) => b.wpa    - a.wpa)[0],    [qualBat]);
  const warLeaderB  = useMemo(() => [...qualBat].sort((a, b) => b.war    - a.war)[0],    [qualBat]);
  const warLeaderP  = useMemo(() => [...qualPit].sort((a, b) => b.war    - a.war)[0],    [qualPit]);
  const warLeader   = (!warLeaderB || (warLeaderP && warLeaderP.war > warLeaderB.war)) ? warLeaderP : warLeaderB;

  // WPA risers / watchers
  const wpaRisers  = useMemo(() => [...qualBat].sort((a, b) => b.wpa - a.wpa).slice(0, 5),  [qualBat]);
  const wpaWatchers = useMemo(() => [...qualBat].sort((a, b) => a.wpa - b.wpa).slice(0, 5), [qualBat]);

  // WAR leaders (combined, top 6)
  const warLeaders = useMemo(() => {
    const combined = [
      ...qualBat.map(r => ({ mlbId: r.mlbId, name: r.name, team: r.team, pos: r.pos, war: r.war, type: 'bat' as const })),
      ...qualPit.map(r => ({ mlbId: r.mlbId, name: r.name, team: r.team, pos: r.pos, war: r.war, type: 'pit' as const })),
    ];
    return combined.sort((a, b) => b.war - a.war).slice(0, 6);
  }, [qualBat, qualPit]);

  // League leader counts
  const totalTeams   = standings?.records?.length ?? 30;
  const totalBatters = qualBat.length;
  const totalPitchers = qualPit.length;

  const sparkWoba = useMemo(() => spark(wobaLeader?.woba ?? 0.38, 0.008, wobaLeader?.mlbId ?? 1), [wobaLeader]);
  const sparkWpa  = useMemo(() => spark(wpaLeader?.wpa   ?? 1.5,  0.15,  wpaLeader?.mlbId  ?? 2), [wpaLeader]);
  const sparkWar  = useMemo(() => spark(warLeader?.war   ?? 3.0,  0.2,   warLeader?.mlbId  ?? 3), [warLeader]);

  return (
    <div className="home">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-dot" />
            {YEAR} MLB Season · Live Data
          </div>
          <h1 className="hero-title">
            Front-Office Grade<br />
            <span className="hero-title-accent">Baseball Intelligence</span>
          </h1>
          <p className="hero-sub">
            Advanced analytics powered by live FanGraphs and MLB Stats API data.
            Explore player stats, simulate trades, track clutch performance, and
            generate actionable front-office insights.
          </p>
          <div className="hero-ctas">
            <Link to="/leaderboard" className="hero-cta-primary">
              View Leaderboard <ArrowRight size={16} />
            </Link>
            <Link to="/trade" className="hero-cta-secondary">Trade Analyzer</Link>
          </div>
        </div>

        {/* Live metric cards */}
        <div className="hero-metrics">
          {batLoading ? (
            <div className="hero-metrics-loading">Loading live stats…</div>
          ) : <>
            <HeroMetricCard
              label={`wOBA Leader · ${YEAR}`}
              value={wobaLeader ? wobaLeader.woba.toFixed(3) : '—'}
              sub={wobaLeader ? `${wobaLeader.name} · ${wobaLeader.team}` : 'Loading…'}
              color="#20b2ff"
              data={sparkWoba}
            />
            <HeroMetricCard
              label={`WPA Leader · ${YEAR}`}
              value={wpaLeader ? `+${wpaLeader.wpa.toFixed(2)}` : '—'}
              sub={wpaLeader ? `${wpaLeader.name} · ${wpaLeader.team}` : 'Loading…'}
              color="#00d4aa"
              data={sparkWpa}
            />
            <HeroMetricCard
              label={`WAR Leader · ${YEAR}`}
              value={warLeader ? warLeader.war.toFixed(1) : '—'}
              sub={warLeader ? `${warLeader.name} · ${warLeader.team}` : 'Loading…'}
              color="#a855f7"
              data={sparkWar}
            />
          </>}
        </div>
      </section>

      {/* ── Tools grid ─────────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Analytics Suite</h2>
            <p className="section-sub">Six powerful tools built for the modern front office</p>
          </div>
        </div>
        <div className="tools-grid">
          {TOOLS.map(tool => (
            <Link key={tool.path} to={tool.path} className={`tool-card tool-card--${tool.color}`}>
              <div className="tool-card-top">
                <div className={`tool-card-icon tool-card-icon--${tool.color}`}>{tool.icon}</div>
                <Badge variant={tool.color as any} size="sm">{tool.tag}</Badge>
              </div>
              <h3 className="tool-card-label">{tool.label}</h3>
              <p className="tool-card-desc">{tool.desc}</p>
              <div className="tool-card-arrow">Explore <ArrowRight size={13} /></div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── WPA Risers / Watchers ─────────────────────────────────────── */}
      <div className="home-two-col">
        <Card title="WPA Risers 🔥" subtitle={`Highest Win Probability Added · ${YEAR}`}>
          <div className="trend-list">
            {batLoading
              ? <div className="trend-loading">Loading…</div>
              : wpaRisers.map((r, i) => (
                <Link key={r.mlbId} to="/clutch" className="trend-row trend-row--up">
                  <div className="trend-rank">{i + 1}</div>
                  <div className="trend-headshot">
                    <PlayerHeadshot mlbId={r.mlbId} size={32} alt={r.name} />
                  </div>
                  <div className="trend-info">
                    <span className="trend-name">{r.name}</span>
                    <span className="trend-meta">{r.pos} · {r.team}</span>
                  </div>
                  <div className="trend-stat">
                    <span className="trend-metric">WPA</span>
                    <span className="trend-value">+{r.wpa.toFixed(2)}</span>
                  </div>
                  <div className="trend-change trend-change--up">
                    <TrendingUp size={11} />{r.wrcPlus}
                  </div>
                </Link>
              ))
            }
          </div>
        </Card>

        <Card title="Watch List 📉" subtitle={`Lowest Win Probability Added · ${YEAR}`}>
          <div className="trend-list">
            {batLoading
              ? <div className="trend-loading">Loading…</div>
              : wpaWatchers.map((r, i) => (
                <Link key={r.mlbId} to="/clutch" className="trend-row trend-row--down">
                  <div className="trend-rank">{i + 1}</div>
                  <div className="trend-headshot">
                    <PlayerHeadshot mlbId={r.mlbId} size={32} alt={r.name} />
                  </div>
                  <div className="trend-info">
                    <span className="trend-name">{r.name}</span>
                    <span className="trend-meta">{r.pos} · {r.team}</span>
                  </div>
                  <div className="trend-stat">
                    <span className="trend-metric">WPA</span>
                    <span className="trend-value" style={{ color: '#ef4444' }}>{r.wpa.toFixed(2)}</span>
                  </div>
                  <div className="trend-change trend-change--down">
                    <TrendingDown size={11} />{r.wrcPlus}
                  </div>
                </Link>
              ))
            }
          </div>
        </Card>
      </div>

      {/* ── WAR Leaders ───────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">WAR Leaders · {YEAR}</h2>
            <p className="section-sub">Top performers by Wins Above Replacement — batters &amp; pitchers combined</p>
          </div>
          <Link to="/leaderboard" className="section-link">Full leaderboard <ArrowRight size={13} /></Link>
        </div>
        <div className="war-grid">
          {batLoading
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="war-card war-card--skeleton" />)
            : warLeaders.map((p, i) => (
              <Link key={p.mlbId} to="/leaderboard" className="war-card">
                <div className="war-card-rank">#{i + 1}</div>
                <div className="war-card-headshot">
                  <PlayerHeadshot mlbId={p.mlbId} size={44} alt={p.name} />
                </div>
                <div className="war-card-info">
                  <span className="war-card-name">{p.name}</span>
                  <span className="war-card-meta">{p.pos} · {p.team}</span>
                </div>
                <div className="war-card-stat">
                  <span className="war-card-value">{p.war.toFixed(1)}</span>
                  <div className="war-bar-track">
                    <div className="war-bar-fill" style={{ width: `${Math.min((p.war / (warLeaders[0]?.war ?? 8)) * 100, 100)}%` }} />
                  </div>
                  <span className="war-card-label">WAR</span>
                </div>
              </Link>
            ))
          }
        </div>
      </section>

      {/* ── Stats blurb ───────────────────────────────────────────────── */}
      <div className="home-stats-row">
        {[
          { label: 'Qualified Batters',  value: batLoading ? '…' : totalBatters.toString(), icon: <Users size={18} />    },
          { label: 'Qualified Pitchers', value: batLoading ? '…' : totalPitchers.toString(), icon: <Activity size={18} /> },
          { label: 'MLB Teams',          value: '30',                                         icon: <Shield size={18} />   },
          { label: 'Analytics Tools',    value: '6',                                          icon: <Trophy size={18} />   },
        ].map(s => (
          <div key={s.label} className="stats-blurb">
            <div className="stats-blurb-icon">{s.icon}</div>
            <div>
              <div className="stats-blurb-value">{s.value}</div>
              <div className="stats-blurb-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
