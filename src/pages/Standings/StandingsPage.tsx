import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../../components/ui/Badge';
import TeamLogo from '../../components/ui/TeamLogo';
import { useTeamStandings } from '../../hooks/useMLBData';
import type { MLBStandingsDivision, MLBStandingsTeamRecord } from '../../data/api/mlbStats';
import '../../styles/shared.css';
import './StandingsPage.css';

const YEAR = new Date().getFullYear();

// ─── Team lookup maps ─────────────────────────────────────────────────

const TEAM_ABV: Record<number, string> = {
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

const DIV_SHORT: Record<number, string> = {
  200: 'AL West', 201: 'AL East', 202: 'AL Central',
  203: 'NL West', 204: 'NL East', 205: 'NL Central',
};

const AL_DIVS = [201, 202, 200];
const NL_DIVS = [204, 205, 203];

// ─── Shared helpers ───────────────────────────────────────────────────

function abbr(teamId: number): string {
  return TEAM_ABV[teamId] ?? '???';
}

function splitRecord(tr: MLBStandingsTeamRecord, type: string): string {
  const all = [
    ...(tr.records?.splitRecords   ?? []),
    ...(tr.records?.overallRecords ?? []),
  ];
  const r = all.find(s => s.type === type);
  return r ? `${r.wins}-${r.losses}` : '—';
}

function streakColor(code: string): string {
  if (code.startsWith('W')) return 'var(--color-teal)';
  if (code.startsWith('L')) return '#ef4444';
  return 'var(--color-text-secondary)';
}

function runDiff(rs: number, ra: number): string {
  const d = rs - ra;
  return d > 0 ? `+${d}` : `${d}`;
}

function runDiffColor(rs: number, ra: number): string {
  const d = rs - ra;
  if (d > 0) return 'var(--color-teal)';
  if (d < 0) return '#ef4444';
  return 'var(--color-text-secondary)';
}

function playoffStatus(tr: MLBStandingsTeamRecord): 'div' | 'wc' | null {
  if (tr.divisionLeader || parseInt(tr.divisionRank, 10) === 1) return 'div';
  const wc = parseInt(tr.wildCardRank, 10);
  if (!isNaN(wc) && wc >= 1 && wc <= 3) return 'wc';
  return null;
}

// Reusable team-badge cell used in both division and WC tables
function TeamBadgeCell({ tr }: { tr: MLBStandingsTeamRecord }) {
  const status = playoffStatus(tr);
  return (
    <div className="std-team-cell">
      <span
        className={`std-playoff-dot ${
          status === 'div' ? 'std-playoff-dot--div' :
          status === 'wc'  ? 'std-playoff-dot--wc'  :
          'std-playoff-dot--out'
        }`}
        title={status === 'div' ? 'Division Leader' : status === 'wc' ? 'Wild Card' : ''}
      />
      <div className="std-team-logo-wrap">
        <TeamLogo teamId={tr.team.id} size={20} />
      </div>
      <span className="std-team-name">{tr.team.name}</span>
    </div>
  );
}

// ─── Division card ────────────────────────────────────────────────────

function DivisionCard({ division }: { division: MLBStandingsDivision }) {
  const navigate = useNavigate();
  const sorted = useMemo(
    () => [...division.teamRecords].sort(
      (a, b) => parseInt(a.divisionRank, 10) - parseInt(b.divisionRank, 10)
    ),
    [division.teamRecords]
  );

  const divLabel = DIV_SHORT[division.division.id] ?? division.division.name;

  return (
    <div className="std-division-card">
      <div className="std-division-header">
        <span className="std-division-name">{divLabel}</span>
      </div>
      <div className="std-table-wrapper">
        <table className="std-table">
          <thead>
            <tr>
              <th className="std-th std-th--team">Team</th>
              <th className="std-th">W</th>
              <th className="std-th">L</th>
              <th className="std-th">PCT</th>
              <th className="std-th">GB</th>
              <th className="std-th">L10</th>
              <th className="std-th">STRK</th>
              <th className="std-th std-hide-sm">HOME</th>
              <th className="std-th std-hide-sm">AWAY</th>
              <th className="std-th std-hide-sm">RS</th>
              <th className="std-th std-hide-sm">RA</th>
              <th className="std-th std-hide-sm">DIFF</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(tr => {
              const status = playoffStatus(tr);
              const streak = tr.streak?.streakCode ?? '—';
              const rs     = tr.runsScored  ?? 0;
              const ra     = tr.runsAllowed ?? 0;
              return (
                <tr
                  key={tr.team.id}
                  className={`std-tr std-tr--clickable ${status === 'div' ? 'std-tr--div' : status === 'wc' ? 'std-tr--wc' : ''}`}
                  onClick={() => navigate(`/team/${tr.team.id}`)}
                  title={`View ${tr.team.name}`}
                >
                  <td className="std-td std-td--team"><TeamBadgeCell tr={tr} /></td>
                  <td className="std-td std-td--num std-w">{tr.wins}</td>
                  <td className="std-td std-td--num std-l">{tr.losses}</td>
                  <td className="std-td std-td--num std-pct">{tr.pct}</td>
                  <td className="std-td std-td--num">
                    {tr.gamesBack === '-' ? <span className="std-leader-dash">—</span> : tr.gamesBack}
                  </td>
                  <td className="std-td std-td--num">{splitRecord(tr, 'lastTen')}</td>
                  <td className="std-td std-td--num" style={{ color: streakColor(streak), fontWeight: 700 }}>{streak}</td>
                  <td className="std-td std-td--num std-hide-sm">{splitRecord(tr, 'home')}</td>
                  <td className="std-td std-td--num std-hide-sm">{splitRecord(tr, 'away')}</td>
                  <td className="std-td std-td--num std-hide-sm">{rs || '—'}</td>
                  <td className="std-td std-td--num std-hide-sm">{ra || '—'}</td>
                  <td
                    className="std-td std-td--num std-hide-sm"
                    style={{ color: rs && ra ? runDiffColor(rs, ra) : 'var(--color-text-tertiary)', fontWeight: 700 }}
                  >
                    {rs && ra ? runDiff(rs, ra) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Wild card standings card ─────────────────────────────────────────

const WC_SPOTS = 3; // spots per league

function WildCardCard({
  divisions,
  leagueLabel,
}: {
  divisions: MLBStandingsDivision[];
  leagueLabel: string;
}) {
  const navigate = useNavigate();
  // All non-division-leaders across the league, sorted by WC rank then PCT
  const wcTeams = useMemo(() => {
    const all: MLBStandingsTeamRecord[] = [];
    for (const div of divisions) {
      for (const tr of div.teamRecords) {
        const divRank = parseInt(tr.divisionRank, 10);
        if (!tr.divisionLeader && divRank !== 1) all.push(tr);
      }
    }
    return all.sort((a, b) => {
      const wa = parseInt(a.wildCardRank, 10);
      const wb = parseInt(b.wildCardRank, 10);
      const aValid = !isNaN(wa);
      const bValid = !isNaN(wb);
      if (aValid && bValid) return wa - wb;
      if (aValid) return -1;
      if (bValid) return 1;
      // fallback: sort by PCT descending
      return parseFloat(b.pct) - parseFloat(a.pct);
    });
  }, [divisions]);

  if (!wcTeams.length) return null;

  return (
    <div className="std-wc-card">
      <div className="std-division-header std-wc-header">
        <span className="std-division-name">{leagueLabel} Wild Card Race</span>
        <span className="std-wc-note">Top {WC_SPOTS} qualify · {wcTeams.length} teams competing</span>
      </div>
      <div className="std-table-wrapper">
        <table className="std-table">
          <thead>
            <tr>
              <th className="std-th" style={{ width: 36 }}>#</th>
              <th className="std-th std-th--team">Team</th>
              <th className="std-th">W</th>
              <th className="std-th">L</th>
              <th className="std-th">PCT</th>
              <th className="std-th">WCGB</th>
              <th className="std-th">L10</th>
              <th className="std-th">STRK</th>
              <th className="std-th std-hide-sm">HOME</th>
              <th className="std-th std-hide-sm">AWAY</th>
              <th className="std-th std-hide-sm">RS</th>
              <th className="std-th std-hide-sm">RA</th>
              <th className="std-th std-hide-sm">DIFF</th>
            </tr>
          </thead>
          <tbody>
            {wcTeams.map((tr, idx) => {
              const wcRank = parseInt(tr.wildCardRank, 10);
              const rank   = !isNaN(wcRank) ? wcRank : idx + 1;
              const inWC   = rank <= WC_SPOTS;
              const streak = tr.streak?.streakCode ?? '—';
              const rs     = tr.runsScored  ?? 0;
              const ra     = tr.runsAllowed ?? 0;
              const wcgb   = tr.wildCardGamesBack;
              const isLastWcSpot = rank === WC_SPOTS; // draw cutoff line after this row

              return (
                <tr
                  key={tr.team.id}
                  className={`std-tr std-tr--clickable ${inWC ? 'std-tr--wc' : ''} ${isLastWcSpot ? 'std-tr--wc-cutoff' : ''}`}
                  onClick={() => navigate(`/team/${tr.team.id}`)}
                  title={`View ${tr.team.name}`}
                >
                  {/* WC rank number */}
                  <td className="std-td std-td--num">
                    <span
                      className="std-wc-rank"
                      style={{
                        color: rank === 1 ? '#f59e0b'
                             : rank <= WC_SPOTS ? 'var(--color-accent)'
                             : 'var(--color-text-tertiary)',
                      }}
                    >
                      {rank}
                    </span>
                  </td>

                  <td className="std-td std-td--team"><TeamBadgeCell tr={tr} /></td>
                  <td className="std-td std-td--num std-w">{tr.wins}</td>
                  <td className="std-td std-td--num std-l">{tr.losses}</td>
                  <td className="std-td std-td--num std-pct">{tr.pct}</td>

                  {/* WCGB — games behind 1st WC */}
                  <td className="std-td std-td--num">
                    {!wcgb || wcgb === '-' || wcgb === '' ? (
                      <span className="std-leader-dash">—</span>
                    ) : (
                      wcgb
                    )}
                  </td>

                  <td className="std-td std-td--num">{splitRecord(tr, 'lastTen')}</td>
                  <td className="std-td std-td--num" style={{ color: streakColor(streak), fontWeight: 700 }}>{streak}</td>
                  <td className="std-td std-td--num std-hide-sm">{splitRecord(tr, 'home')}</td>
                  <td className="std-td std-td--num std-hide-sm">{splitRecord(tr, 'away')}</td>
                  <td className="std-td std-td--num std-hide-sm">{rs || '—'}</td>
                  <td className="std-td std-td--num std-hide-sm">{ra || '—'}</td>
                  <td
                    className="std-td std-td--num std-hide-sm"
                    style={{ color: rs && ra ? runDiffColor(rs, ra) : 'var(--color-text-tertiary)', fontWeight: 700 }}
                  >
                    {rs && ra ? runDiff(rs, ra) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

type League = 'AL' | 'NL';

export default function StandingsPage() {
  const [league, setLeague] = useState<League>('AL');
  const { data, isLoading } = useTeamStandings(YEAR);

  const pick = (ids: number[]) =>
    ids
      .map(id => data?.records?.find(r => r.division.id === id))
      .filter((d): d is MLBStandingsDivision => !!d);

  const alDivisions = useMemo(() => pick(AL_DIVS), [data]);
  const nlDivisions = useMemo(() => pick(NL_DIVS), [data]);
  const divisions   = league === 'AL' ? alDivisions : nlDivisions;

  return (
    <div className="standings-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">MLB Standings</h1>
          <p className="page-subtitle">
            Live standings · {YEAR} regular season · Source: MLB Stats API
          </p>
        </div>
        <div className="page-header-controls">
          <div className="std-league-tabs">
            {(['AL', 'NL'] as League[]).map(l => (
              <button
                key={l}
                className={`std-league-tab ${league === l ? 'std-league-tab--active' : ''}`}
                onClick={() => setLeague(l)}
              >
                {l}
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
          Fetching {YEAR} standings from MLB Stats API…
        </div>
      )}

      {!isLoading && divisions.length > 0 && (
        <>
          {/* Legend */}
          <div className="std-legend">
            <span className="std-playoff-dot std-playoff-dot--div" />
            <span className="std-legend-label">Division Leader</span>
            <span className="std-playoff-dot std-playoff-dot--wc" />
            <span className="std-legend-label">Wild Card (Top 3)</span>
            <span className="std-playoff-dot std-playoff-dot--out" />
            <span className="std-legend-label">Out of Playoffs</span>
          </div>

          {/* ── Division standings ── */}
          <div className="std-section-label">Division Standings</div>
          <div className="std-divisions-grid">
            {divisions.map(div => (
              <DivisionCard key={div.division.id} division={div} />
            ))}
          </div>

          {/* ── Wild card race ── */}
          <div className="std-section-label" style={{ marginTop: 8 }}>Wild Card Race</div>
          <WildCardCard divisions={divisions} leagueLabel={league} />
        </>
      )}

      {/* Empty state */}
      {!isLoading && divisions.length === 0 && (
        <div className="live-prompt">
          <div className="live-prompt-icon">🏆</div>
          <p>Standings not yet available for the {YEAR} season.</p>
          <p className="live-prompt-sub">MLB Stats API may not have data yet — check back once the season begins.</p>
        </div>
      )}
    </div>
  );
}
