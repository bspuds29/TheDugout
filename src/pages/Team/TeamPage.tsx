import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import TeamLogo from '../../components/ui/TeamLogo';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import ShareButton from '../../components/ui/ShareButton';
import {
  useTeamStandings,
  useTeamSchedule,
  useTeamSeasonStats,
  useTeamRoster,    // existing hook: useTeamRoster(teamId, rosterType?)
} from '../../hooks/useMLBData';
import type { MLBStandingsTeamRecord, RawMLBRosterPlayerHydrated } from '../../data/api/mlbStats';
import '../../styles/shared.css';
import './TeamPage.css';

const SEASON = new Date().getFullYear();

// ─── Team colour map (matches StandingsPage) ──────────────────────────

const TEAM_ABBV: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC',
  113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC',  119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH',
  134: 'PIT', 135: 'SD',  136: 'SEA', 137: 'SF',  138: 'STL',
  139: 'TB',  140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI',
  144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL',
};

const TEAM_COLORS: Record<string, string> = {
  LAA: '#BA0021', ARI: '#A71930', BAL: '#DF4601', BOS: '#BD3039',
  CHC: '#0E3386', CWS: '#27251F', CIN: '#C6011F', CLE: '#E31937',
  COL: '#33006F', DET: '#0C2340', HOU: '#002D62', KC:  '#004687',
  LAD: '#005A9C', WSH: '#AB0003', NYM: '#002D72', ATH: '#003831',
  PIT: '#FDB827', SD:  '#2F241D', SEA: '#0C2C56', SF:  '#FD5A1E',
  STL: '#C41E3A', TB:  '#092C5C', TEX: '#003278', TOR: '#134A8E',
  MIN: '#002B5C', PHI: '#E81828', ATL: '#CE1141', MIA: '#00A3E0',
  NYY: '#003087', MIL: '#12284B',
};

const DIV_NAMES: Record<number, string> = {
  200: 'AL West', 201: 'AL East', 202: 'AL Central',
  203: 'NL West', 204: 'NL East', 205: 'NL Central',
};

// ─── Position grouping ────────────────────────────────────────────────

// Lower number = higher priority when deduplicating depth-chart entries.
// depthChart returns players in every slot they fill (e.g. Roman Anthony
// appears as LF, RF, AND DH). We keep only the most descriptive position.
const POS_PRIORITY: Record<string, number> = {
  SP: 0, RP: 1, CP: 1, CL: 1,
  C: 2,
  '1B': 3, '2B': 3, '3B': 3, SS: 3,
  LF: 4, CF: 4, RF: 4, OF: 4,
  P:  8,   // generic pitcher — above DH
  DH: 9,   // DH last: only kept when it's the player's sole listing
};

function posGroup(abbr: string): string {
  const a = abbr.toUpperCase();
  if (a === 'C')  return 'Catchers';
  if (['1B', '2B', '3B', 'SS'].includes(a)) return 'Infielders';
  if (['LF', 'CF', 'RF', 'OF'].includes(a)) return 'Outfielders';
  if (a === 'DH') return 'Designated Hitter';
  if (a === 'SP') return 'Starting Pitchers';
  if (['RP', 'CL', 'CP', 'MR', 'RL', 'P'].includes(a)) return 'Relief Pitchers';
  return 'Other';
}

const POS_GROUP_ORDER = [
  'Catchers', 'Infielders', 'Outfielders', 'Designated Hitter',
  'Starting Pitchers', 'Relief Pitchers', 'Other',
];

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  // e.g. "2025-04-15" → "Apr 15"
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function streakColor(code: string): string {
  if (code.startsWith('W')) return 'var(--color-teal)';
  if (code.startsWith('L')) return '#ef4444';
  return 'var(--color-text-secondary)';
}

function statColor(val: number, neutral: number, goodHigh = true): string {
  const diff = val - neutral;
  if (goodHigh) {
    if (diff > 0.015) return 'var(--color-teal)';
    if (diff < -0.015) return '#ef4444';
  } else {
    if (diff < -0.5) return 'var(--color-teal)';
    if (diff > 0.5)  return '#ef4444';
  }
  return 'var(--color-text-primary)';
}

// ─── Sub-components ───────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="tp-skeleton-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}><span className="tp-skeleton" /></td>
      ))}
    </tr>
  );
}

// ─── Hero banner ──────────────────────────────────────────────────────

interface HeroProps {
  teamId: number;
  teamRecord: MLBStandingsTeamRecord | undefined;
  teamName: string;
  abbr: string;
  color: string;
  divName: string;
}

function TeamHero({ teamId, teamRecord, teamName, abbr, color, divName }: HeroProps) {
  const w      = teamRecord?.wins   ?? 0;
  const l      = teamRecord?.losses ?? 0;
  const pct    = w + l > 0 ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '.000';
  const gb     = teamRecord?.gamesBack ?? '-';
  const streak = teamRecord?.streak?.streakCode ?? '—';
  const rs     = teamRecord?.runsScored  ?? 0;
  const ra     = teamRecord?.runsAllowed ?? 0;
  const runDiff = rs - ra;
  const divLeader = teamRecord?.divisionLeader;

  return (
    <div className="tp-hero" style={{ '--team-color': color } as React.CSSProperties}>
      <div className="tp-hero-glow" style={{ background: color }} />
      <div className="tp-hero-content">
        <div className="tp-hero-logo">
          <TeamLogo teamId={teamId} size={80} />
        </div>
        <div className="tp-hero-info">
          <div className="tp-hero-meta">
            <span className="tp-hero-division">{divName}</span>
            {divLeader && <Badge variant="teal">Division Leader</Badge>}
          </div>
          <h1 className="tp-hero-name">{teamName}</h1>
          <div className="tp-hero-record">
            <span className="tp-record-nums">{w}–{l}</span>
            <span className="tp-record-pct">{pct}</span>
            <span className="tp-record-gb">{gb === '-' ? 'First Place' : `${gb} GB`}</span>
          </div>
          <div className="tp-hero-tags">
            <span className="tp-tag">
              STREAK <strong style={{ color: streakColor(streak) }}>{streak}</strong>
            </span>
            <span className="tp-tag">
              RS <strong>{rs || '—'}</strong>
            </span>
            <span className="tp-tag">
              RA <strong>{ra || '—'}</strong>
            </span>
            {rs > 0 && ra > 0 && (
              <span className="tp-tag">
                DIFF <strong style={{ color: runDiff >= 0 ? 'var(--color-teal)' : '#ef4444' }}>
                  {runDiff >= 0 ? '+' : ''}{runDiff}
                </strong>
              </span>
            )}
          </div>
          <ShareButton
            title={`${teamName} · The Dugout`}
            text={`${teamName} ${w}–${l} (${pct}) | The Dugout MLB Analytics`}
            className="tp-hero-share"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Recent games table ───────────────────────────────────────────────

function RecentGames({ teamId }: { teamId: number }) {
  const { data: games = [], isLoading } = useTeamSchedule(teamId);

  // Only show completed games (games with a score)
  const today = new Date().toISOString().slice(0, 10);
  const recent = useMemo(
    () => games.filter(g => g.gameDate <= today && g.score).slice(-15),
    [games, today],
  );

  if (isLoading) {
    return (
      <Card title="Recent Games" className="tp-card">
        <table className="tp-table"><tbody>
          {[...Array(8)].map((_, i) => <SkeletonRow key={i} cols={4} />)}
        </tbody></table>
      </Card>
    );
  }

  const w = recent.filter(g => g.isWin).length;

  return (
    <Card
      title="Recent Games"
      subtitle={recent.length ? `${w}–${recent.length - w} last ${recent.length}` : undefined}
      className="tp-card"
    >
      {recent.length === 0 ? (
        <p className="tp-empty">No recent games available.</p>
      ) : (
        <div className="tp-table-wrapper">
          <table className="tp-table">
            <thead>
              <tr>
                <th className="tp-th">Date</th>
                <th className="tp-th">Matchup</th>
                <th className="tp-th tp-th--center">Score</th>
                <th className="tp-th tp-th--center">Result</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(g => {
                const myScore  = g.isHome ? g.score?.home : g.score?.away;
                const oppScore = g.isHome ? g.score?.away : g.score?.home;
                return (
                  <tr key={g.gamePk} className={`tp-tr ${g.isWin ? 'tp-tr--win' : 'tp-tr--loss'}`}>
                    <td className="tp-td tp-td--date">{fmtDate(g.gameDate)}</td>
                    <td className="tp-td tp-td--matchup">
                      <span className="tp-vs">{g.isHome ? 'vs' : '@'}</span>
                      <TeamLogo teamId={g.opponent.id} size={16} style={{ margin: '0 4px' }} />
                      <span className="tp-opp-abbr">{g.opponent.abbreviation}</span>
                    </td>
                    <td className="tp-td tp-td--center">
                      <span className="tp-score">{myScore}–{oppScore}</span>
                    </td>
                    <td className="tp-td tp-td--center">
                      <span className={`tp-result tp-result--${g.isWin ? 'w' : 'l'}`}>
                        {g.isWin ? 'W' : 'L'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Team season stats ────────────────────────────────────────────────

function TeamStats({ teamId }: { teamId: number }) {
  const { data: stats, isLoading } = useTeamSeasonStats(teamId);

  const bat = stats?.batting;
  const pit = stats?.pitching;

  return (
    <div className="tp-stats-grid">
      {/* Batting */}
      <Card title="Team Batting" subtitle={`${SEASON} Season`} className="tp-card">
        {isLoading ? (
          <div className="tp-stat-rows">
            {[...Array(6)].map((_, i) => <div key={i} className="tp-skeleton tp-skeleton--row" />)}
          </div>
        ) : bat ? (
          <div className="tp-stat-rows">
            <StatRow label="AVG"  value={bat.avg}  color={statColor(parseFloat(bat.avg), 0.250)} />
            <StatRow label="OBP"  value={bat.obp}  color={statColor(parseFloat(bat.obp), 0.320)} />
            <StatRow label="SLG"  value={bat.slg}  color={statColor(parseFloat(bat.slg), 0.410)} />
            <StatRow label="OPS"  value={bat.ops}  color={statColor(parseFloat(bat.ops), 0.720)} />
            <StatRow label="HR"   value={String(bat.hr)} />
            <StatRow label="RBI"  value={String(bat.rbi)} />
            <StatRow label="R"    value={String(bat.r)} />
            <StatRow label="SB"   value={String(bat.sb)} />
            <StatRow label="BB"   value={String(bat.bb)} />
            <StatRow label="K"    value={String(bat.k)} />
          </div>
        ) : (
          <p className="tp-empty">No batting data yet.</p>
        )}
      </Card>

      {/* Pitching */}
      <Card title="Team Pitching" subtitle={`${SEASON} Season`} className="tp-card">
        {isLoading ? (
          <div className="tp-stat-rows">
            {[...Array(6)].map((_, i) => <div key={i} className="tp-skeleton tp-skeleton--row" />)}
          </div>
        ) : pit ? (
          <div className="tp-stat-rows">
            <StatRow label="ERA"  value={pit.era}  color={statColor(parseFloat(pit.era), 4.20, false)} />
            <StatRow label="WHIP" value={pit.whip} color={statColor(parseFloat(pit.whip), 1.30, false)} />
            <StatRow label="K/9"  value={pit.k9}   color={statColor(parseFloat(pit.k9), 8.5)} />
            <StatRow label="BB/9" value={pit.bb9}  color={statColor(parseFloat(pit.bb9), 3.2, false)} />
            <StatRow label="W"    value={String(pit.w)} />
            <StatRow label="L"    value={String(pit.l)} />
            <StatRow label="SV"   value={String(pit.sv)} />
            <StatRow label="IP"   value={pit.ip} />
            <StatRow label="K"    value={String(pit.k)} />
            <StatRow label="HR"   value={String(pit.hr)} />
          </div>
        ) : (
          <p className="tp-empty">No pitching data yet.</p>
        )}
      </Card>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="tp-stat-row">
      <span className="tp-stat-label">{label}</span>
      <span className="tp-stat-value" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}

// ─── Active roster ────────────────────────────────────────────────────

function RosterSection({ teamId }: { teamId: number }) {
  const { data: roster = [], isLoading } = useTeamRoster(teamId, 'depthChart');
  const navigate = useNavigate();

  const grouped = useMemo(() => {
    // depthChart lists players in every slot they fill — deduplicate by player id,
    // keeping whichever entry has the highest-priority (most specific) position.
    const bestByPlayer = new Map<number, RawMLBRosterPlayerHydrated>();
    for (const player of roster) {
      const id  = player.person.id;
      const pos = player.position.abbreviation.toUpperCase();
      const existing = bestByPlayer.get(id);
      if (!existing) {
        bestByPlayer.set(id, player);
      } else {
        const cur = existing.position.abbreviation.toUpperCase();
        const priority = (p: string) => POS_PRIORITY[p] ?? 6;
        if (priority(pos) < priority(cur)) {
          bestByPlayer.set(id, player);
        }
      }
    }
    const deduped = Array.from(bestByPlayer.values());

    const map = new Map<string, RawMLBRosterPlayerHydrated[]>();
    for (const player of deduped) {
      const grp = posGroup(player.position.abbreviation);
      if (!map.has(grp)) map.set(grp, []);
      map.get(grp)!.push(player);
    }
    // Sort within each group by jersey number
    for (const [, players] of map) {
      players.sort((a, b) => {
        const na = parseInt(a.jerseyNumber ?? '99', 10);
        const nb = parseInt(b.jerseyNumber ?? '99', 10);
        return na - nb;
      });
    }
    // Return in position order
    return POS_GROUP_ORDER
      .map(grpName => ({ name: grpName, players: map.get(grpName) ?? [] }))
      .filter(g => g.players.length > 0);
  }, [roster]);

  const rosterCount = useMemo(() => {
    const seen = new Set<number>();
    for (const p of roster) seen.add(p.person.id);
    return seen.size;
  }, [roster]);

  return (
    <Card title="Active Roster" subtitle={`${rosterCount} players`} className="tp-card">
      {isLoading ? (
        <table className="tp-table"><tbody>
          {[...Array(10)].map((_, i) => <SkeletonRow key={i} cols={4} />)}
        </tbody></table>
      ) : roster.length === 0 ? (
        <p className="tp-empty">Roster unavailable.</p>
      ) : (
        <div className="tp-roster-groups">
          {grouped.map(group => (
            <div key={group.name} className="tp-roster-group">
              <div className="tp-roster-group-label">{group.name}</div>
              <div className="tp-table-wrapper">
                <table className="tp-table">
                  <thead>
                    <tr>
                      <th className="tp-th tp-th--num">#</th>
                      <th className="tp-th">Name</th>
                      <th className="tp-th tp-th--center">POS</th>
                      <th className="tp-th tp-th--center tp-hide-sm">B/T</th>
                      <th className="tp-th tp-th--center tp-hide-sm">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.players.map(p => {
                      const id   = p.person.id;
                      const name = p.person.fullName;
                      // depthChart returns 'P' for all non-closer relievers; display as 'RP'
                      const pos  = p.position.abbreviation === 'P' ? 'RP' : p.position.abbreviation;
                      const bat  = p.person.batSide?.code ?? '—';
                      const thr  = p.person.pitchHand?.code ?? '—';
                      const age  = p.person.currentAge ?? '—';
                      return (
                        <tr
                          key={id}
                          className="tp-tr tp-tr--clickable"
                          onClick={() => navigate(`/player?mlbId=${id}&name=${encodeURIComponent(name)}`)}
                          title={`View ${name}`}
                        >
                          <td className="tp-td tp-td--num tp-jersey">{p.jerseyNumber ?? '—'}</td>
                          <td className="tp-td tp-td--name">{name}</td>
                          <td className="tp-td tp-td--center">
                            <span className="tp-pos-badge">{pos}</span>
                          </td>
                          <td className="tp-td tp-td--center tp-hide-sm">{bat}/{thr}</td>
                          <td className="tp-td tp-td--center tp-hide-sm">{age}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function TeamPage() {
  const { teamId: teamIdParam } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const teamId = teamIdParam ? parseInt(teamIdParam, 10) : null;

  const { data: standingsData, isLoading: standingsLoading } = useTeamStandings(SEASON);

  // Find this team's record in standings
  const teamRecord = useMemo<MLBStandingsTeamRecord | undefined>(() => {
    if (!standingsData || !teamId) return undefined;
    for (const div of standingsData.records) {
      const tr = div.teamRecords.find(r => r.team.id === teamId);
      if (tr) return tr;
    }
    return undefined;
  }, [standingsData, teamId]);

  // Find division name
  const divName = useMemo<string>(() => {
    if (!standingsData || !teamId) return '';
    for (const div of standingsData.records) {
      if (div.teamRecords.some(r => r.team.id === teamId)) {
        return DIV_NAMES[div.division.id] ?? div.division.name;
      }
    }
    return '';
  }, [standingsData, teamId]);

  const teamName = teamRecord?.team.name ?? '';
  const abbr     = teamId ? (TEAM_ABBV[teamId] ?? '') : '';
  const color    = TEAM_COLORS[abbr] ?? 'var(--color-accent)';

  if (!teamId || isNaN(teamId)) {
    return (
      <div className="tp-not-found">
        <p>Invalid team ID.</p>
        <button onClick={() => navigate('/standings')}>Back to Standings</button>
      </div>
    );
  }

  const w   = teamRecord?.wins   ?? 0;
  const l   = teamRecord?.losses ?? 0;
  const pct = w + l > 0 ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '.000';
  const pageTitle = teamName ? `${teamName} · The Dugout` : 'The Dugout · MLB Analytics';
  const pageDesc  = teamName ? `${teamName} ${w}–${l} (${pct}) ${SEASON} season stats and roster | The Dugout MLB Analytics` : 'MLB team stats and analytics.';
  // Use team logo as OG image (transparent PNG on white bg from MLB CDN)
  const teamOgImg = `https://www.mlbstatic.com/team-logos/${teamId}.svg`;

  return (
    <div className="tp-page">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:image" content={teamOgImg} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={teamOgImg} />
      </Helmet>

      {/* Breadcrumb */}
      <nav className="tp-breadcrumb">
        <Link to="/standings" className="tp-breadcrumb-link">Standings</Link>
        <span className="tp-breadcrumb-sep">›</span>
        <span className="tp-breadcrumb-current">
          {standingsLoading ? 'Loading…' : teamName || `Team ${teamId}`}
        </span>
      </nav>

      {/* Hero */}
      <TeamHero
        teamId={teamId}
        teamRecord={teamRecord}
        teamName={standingsLoading ? '' : (teamName || `Team ${teamId}`)}
        abbr={abbr}
        color={color}
        divName={divName}
      />

      {/* Schedule */}
      <RecentGames teamId={teamId} />

      {/* Batting + Pitching stats */}
      <TeamStats teamId={teamId} />

      {/* Active roster */}
      <RosterSection teamId={teamId} />
    </div>
  );
}
