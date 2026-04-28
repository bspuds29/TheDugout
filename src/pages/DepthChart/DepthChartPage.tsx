import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import {
  useMLBRawTeams,
  useTeamRoster,
  type RawMLBRosterPlayerHydrated,
} from '../../hooks/useMLBData';
import '../../styles/shared.css';

// ─── Position groups ──────────────────────────────────────────────────

interface PosGroup {
  label: string;
  positions: string[];
  color: string;
}

const FIELD_GROUPS: PosGroup[] = [
  { label: 'Catcher',        positions: ['C'],               color: 'var(--color-accent)'  },
  { label: 'First Base',     positions: ['1B'],              color: 'var(--color-teal)'    },
  { label: 'Second Base',    positions: ['2B'],              color: 'var(--color-teal)'    },
  { label: 'Third Base',     positions: ['3B'],              color: 'var(--color-teal)'    },
  { label: 'Shortstop',      positions: ['SS'],              color: 'var(--color-teal)'    },
  { label: 'Left Field',     positions: ['LF'],              color: 'var(--color-green)'   },
  { label: 'Center Field',   positions: ['CF'],              color: 'var(--color-green)'   },
  { label: 'Right Field',    positions: ['RF', 'OF'],        color: 'var(--color-green)'   },
  { label: 'Designated Hitter', positions: ['DH'],           color: 'var(--color-amber)'   },
];

const PITCH_GROUPS: PosGroup[] = [
  { label: 'Starting Pitchers', positions: ['SP'],           color: 'var(--color-accent)'  },
  { label: 'Bullpen',           positions: ['RP', 'CL', 'MR', 'P', 'RL'], color: 'var(--color-purple)' },
];

// ─── Helpers ──────────────────────────────────────────────────────────

function posOf(p: RawMLBRosterPlayerHydrated): string {
  return p.position?.abbreviation ?? p.person.primaryPosition?.abbreviation ?? 'P';
}

function handedness(p: RawMLBRosterPlayerHydrated, isPitcher: boolean): string {
  if (isPitcher) {
    const t = p.person.pitchHand?.code;
    return t ? `T:${t}` : '';
  }
  const b = p.person.batSide?.code;
  const t = p.person.pitchHand?.code;
  const parts = [b ? `B:${b}` : '', t ? `T:${t}` : ''].filter(Boolean);
  return parts.join(' ');
}

// ─── Player row ───────────────────────────────────────────────────────

function DepthPlayerRow({ player, isPitcher }: { player: RawMLBRosterPlayerHydrated; isPitcher: boolean }) {
  const navigate = useNavigate();
  const { id, fullName, currentAge } = player.person;
  const pos  = posOf(player);
  const hand = handedness(player, isPitcher);

  return (
    <div
      className="depth-player-row"
      onClick={() => navigate(`/player?mlbId=${id}&name=${encodeURIComponent(fullName)}`)}
    >
      <PlayerAvatar mlbId={id} name={fullName} size={32} />
      <div className="depth-player-info">
        <div className="depth-player-name">{fullName}</div>
        <div className="depth-player-meta">
          {player.jerseyNumber && <span>#{player.jerseyNumber}</span>}
          {currentAge ? <span>Age {currentAge}</span> : null}
          {hand && <span>{hand}</span>}
        </div>
      </div>
      <span className="depth-pos-badge">{pos}</span>
    </div>
  );
}

// ─── Position group card ──────────────────────────────────────────────

function DepthGroup({
  group,
  roster,
}: {
  group: PosGroup;
  roster: RawMLBRosterPlayerHydrated[];
}) {
  const isPitcherGroup = PITCH_GROUPS.includes(group);
  const players = roster.filter(p => group.positions.includes(posOf(p)));

  return (
    <div className="depth-group">
      <div className="depth-group-header" style={{ color: group.color }}>
        {group.label}
        <span style={{ marginLeft: 6, opacity: 0.5, color: 'var(--color-text-tertiary)' }}>
          ({players.length})
        </span>
      </div>
      {players.length === 0 ? (
        <div className="depth-empty">—</div>
      ) : (
        players.map(p => (
          <DepthPlayerRow key={p.person.id} player={p} isPitcher={isPitcherGroup} />
        ))
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

export default function DepthChartPage() {
  const [teamId, setTeamId] = useState<number | null>(null);
  const { teams, isLoading: teamsLoading } = useMLBRawTeams();
  const { data: roster = [], isLoading: rosterLoading } = useTeamRoster(teamId);

  const selectedTeam = teams.find(t => t.id === teamId);
  const isLoading    = teamsLoading || rosterLoading;

  return (
    <div className="depth-chart-page">

      <div className="page-header">
        <div>
          <h1 className="page-title">Team Depth Chart</h1>
          <p className="page-subtitle">Full 40-man roster organized by position</p>
        </div>
      </div>

      {/* Team selector */}
      <div className="depth-team-bar">
        <select
          className="depth-team-picker"
          value={teamId ?? ''}
          onChange={e => setTeamId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Select a team —</option>
          {[...teams]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
        </select>

        {selectedTeam && (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
            {selectedTeam.name}
            {rosterLoading && ' · Loading…'}
            {!rosterLoading && roster.length > 0 && ` · ${roster.length} players`}
          </span>
        )}
      </div>

      {/* Empty state */}
      {!teamId && (
        <div className="depth-empty-prompt">
          ⚾ Select a team above to view their depth chart.
        </div>
      )}

      {/* Loading */}
      {teamId && isLoading && (
        <div className="depth-empty-prompt" style={{ color: 'var(--color-text-tertiary)' }}>
          Loading roster…
        </div>
      )}

      {/* Roster grid */}
      {teamId && !isLoading && roster.length > 0 && (
        <>
          {/* Position players — 3 columns */}
          <div className="depth-field-grid">
            {FIELD_GROUPS.map(g => (
              <DepthGroup key={g.label} group={g} roster={roster} />
            ))}
          </div>

          {/* Pitchers — 2 columns */}
          <div className="depth-pitch-grid">
            {PITCH_GROUPS.map(g => (
              <DepthGroup key={g.label} group={g} roster={roster} />
            ))}
          </div>
        </>
      )}

      {teamId && !isLoading && roster.length === 0 && (
        <div className="depth-empty-prompt">No roster data found for this team.</div>
      )}
    </div>
  );
}
