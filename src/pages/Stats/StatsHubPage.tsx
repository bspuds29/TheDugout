import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import PlayerAvatar from '../../components/ui/PlayerAvatar';
import Badge from '../../components/ui/Badge';
import {
  usePlayer,
  useHittingStats,
  usePitchingStats,
  useCareerStats,
  useGameLog,
  usePitcherGameLog,
  useDefenseStats,
  useHittingSplits,
  usePitchingSplits,
  usePitchArsenal,
  usePitchSpinStats,
  type HittingSplitEntry,
  type PitchingSplitEntry,
  type HittingSplitsData,
  type PitchingSplitsData,
} from '../../hooks/useMLBData';
import type { GameLogEntry, PitcherGameLogEntry } from '../../data/api/mlbStats';
import '../../styles/shared.css';
import './StatsHubPage.css';

// ─── Constants ────────────────────────────────────────────────────────

const YEAR = new Date().getFullYear();
const PITCHER_POS = ['P', 'SP', 'RP', 'CL', 'TWP'];

// ─── Formatters ───────────────────────────────────────────────────────

function f(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v) || v === 0) return '—';
  return v.toFixed(d);
}
function fz(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v)) return '—';
  return v.toFixed(d);
}
function avg(v: number | null | undefined): string {
  if (!v || isNaN(v)) return '—';
  return v.toFixed(3).replace(/^0\./, '.');
}
function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return v.toFixed(1) + '%';
}
function signed(v: number | null | undefined, d = 1): string {
  if (v == null || isNaN(v)) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(d);
}

// ─── Colour helpers ───────────────────────────────────────────────────

function good(v: number, threshold: number): string | undefined {
  return v >= threshold ? 'var(--color-teal)' : undefined;
}
function bad(v: number, threshold: number): string | undefined {
  return v >= threshold ? '#ef4444' : undefined;
}
function goodLow(v: number, threshold: number): string | undefined {
  return v <= threshold ? 'var(--color-teal)' : undefined;
}
function badHigh(v: number, threshold: number): string | undefined {
  return v >= threshold ? '#ef4444' : undefined;
}

// ─── Stat cell ────────────────────────────────────────────────────────

function S({
  label, value, color, sub,
}: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="sdb-stat">
      <span className="sdb-stat-label">{label}</span>
      <span className="sdb-stat-value" style={{ color }}>{value}</span>
      {sub && <span className="sdb-stat-sub">{sub}</span>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────

function Section({ title, color = 'var(--color-accent)', children }: {
  title: string; color?: string; children: React.ReactNode;
}) {
  return (
    <div className="sdb-section">
      <div className="sdb-section-header" style={{ borderLeftColor: color }}>
        {title}
      </div>
      <div className="sdb-stat-grid">{children}</div>
    </div>
  );
}

// ─── Dense stat table (single-row) ───────────────────────────────────

function StatRow({ headers, cells }: { headers: string[]; cells: (string | React.ReactNode)[] }) {
  return (
    <div className="sdb-table-wrap">
      <table className="sdb-table">
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          <tr>{cells.map((c, i) => <td key={i}>{c}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Splits table ─────────────────────────────────────────────────────

function HittingSplitsTable({ splits }: { splits: HittingSplitsData | null | undefined }) {
  const ROWS: Array<{ key: keyof HittingSplitsData; label: string }> = [
    { key: 'vsLeft',  label: 'vs LHP' },
    { key: 'vsRight', label: 'vs RHP' },
    { key: 'home',    label: 'Home'   },
    { key: 'away',    label: 'Away'   },
    { key: 'day',     label: 'Day'    },
    { key: 'night',   label: 'Night'  },
    { key: 'last7',   label: 'Last 7' },
    { key: 'last30',  label: 'Last 30'},
  ];

  const rows = ROWS.map(r => ({ label: r.label, entry: splits?.[r.key] ?? null })).filter(r => r.entry);

  if (!rows.length) return (
    <div className="sdb-empty">No split data available yet this season.</div>
  );

  return (
    <div className="sdb-table-wrap">
      <table className="sdb-table sdb-table--splits">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Split</th>
            <th>PA</th><th>HR</th><th>RBI</th><th>BB</th><th>K</th><th>SB</th>
            <th className="sdb-th-key">AVG</th>
            <th>OBP</th><th>SLG</th>
            <th className="sdb-th-key">OPS</th>
            <th>BABIP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, entry: e }) => {
            if (!e) return null;
            const ops = parseFloat(e.ops);
            return (
              <tr key={label}>
                <td className="sdb-split-label">{label}</td>
                <td>{e.pa}</td>
                <td>{e.hr || '—'}</td>
                <td>{e.rbi || '—'}</td>
                <td>{e.bb || '—'}</td>
                <td>{e.k || '—'}</td>
                <td>{e.sb || '—'}</td>
                <td className="sdb-td-key" style={{ color: parseFloat(e.avg) >= 0.280 ? 'var(--color-teal)' : parseFloat(e.avg) < 0.220 ? '#ef4444' : undefined }}>
                  {e.avg.replace(/^0\./, '.')}
                </td>
                <td>{e.obp.replace(/^0\./, '.')}</td>
                <td>{e.slg.replace(/^0\./, '.')}</td>
                <td className="sdb-td-key" style={{ color: ops >= 0.850 ? 'var(--color-teal)' : ops < 0.650 ? '#ef4444' : undefined }}>
                  {e.ops.replace(/^0\./, '.')}
                </td>
                <td>{e.babip?.replace(/^0\./, '.') ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PitchingSplitsTable({ splits }: { splits: PitchingSplitsData | null | undefined }) {
  const ROWS: Array<{ key: keyof PitchingSplitsData; label: string }> = [
    { key: 'vsLeft',  label: 'vs LHB' },
    { key: 'vsRight', label: 'vs RHB' },
    { key: 'home',    label: 'Home'   },
    { key: 'away',    label: 'Away'   },
    { key: 'day',     label: 'Day'    },
    { key: 'night',   label: 'Night'  },
    { key: 'last7',   label: 'Last 7' },
    { key: 'last30',  label: 'Last 30'},
  ];

  const rows = ROWS.map(r => ({ label: r.label, entry: splits?.[r.key] ?? null })).filter(r => r.entry);

  if (!rows.length) return (
    <div className="sdb-empty">No split data available yet this season.</div>
  );

  return (
    <div className="sdb-table-wrap">
      <table className="sdb-table sdb-table--splits">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Split</th>
            <th>BF</th><th>IP</th><th>K</th><th>BB</th><th>HR</th><th>ER</th>
            <th className="sdb-th-key">ERA</th>
            <th>K/9</th><th>BB/9</th>
            <th>AVG</th><th>OBP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, entry: e }) => {
            if (!e) return null;
            return (
              <tr key={label}>
                <td className="sdb-split-label">{label}</td>
                <td>{e.bf}</td>
                <td>{e.ip.toFixed(1)}</td>
                <td>{e.k}</td>
                <td>{e.bb}</td>
                <td>{e.hr || '—'}</td>
                <td>{e.er}</td>
                <td className="sdb-td-key" style={{ color: e.era <= 3.50 ? 'var(--color-teal)' : e.era >= 5.00 ? '#ef4444' : undefined }}>
                  {e.era.toFixed(2)}
                </td>
                <td>{e.k9.toFixed(1)}</td>
                <td>{e.bb9.toFixed(1)}</td>
                <td>{e.avg.replace(/^0\./, '.')}</td>
                <td>{e.obp.replace(/^0\./, '.')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Hitter game log ──────────────────────────────────────────────────

function HitterLog({ log }: { log: GameLogEntry[] }) {
  let cumH = 0, cumAB = 0;
  const withAvg = log.map(g => {
    cumH  += g.hits; cumAB += g.atBats;
    return { ...g, sAvg: cumAB > 0 ? cumH / cumAB : null };
  });
  const rows = [...withAvg].reverse().slice(0, 50);

  return (
    <div className="sdb-table-wrap">
      <table className="sdb-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'left' }}>Opp</th>
            <th>AB</th><th>H</th><th>2B</th><th>3B</th><th>HR</th>
            <th>RBI</th><th>R</th><th>BB</th><th>K</th><th>SB</th>
            <th className="sdb-th-key">Season AVG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>{g.date?.slice(5) ?? '—'}</td>
              <td style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>{g.isHome ? 'vs' : '@'}</span>
                {' '}{g.opponent}
              </td>
              <td>{g.atBats}</td>
              <td style={{ color: g.hits > 0 ? 'var(--color-teal)' : undefined, fontWeight: g.hits > 0 ? 700 : undefined }}>{g.hits}</td>
              <td>{g.doubles || '—'}</td>
              <td>{g.triples || '—'}</td>
              <td style={{ color: g.homeRuns > 0 ? '#ef4444' : undefined, fontWeight: g.homeRuns > 0 ? 700 : undefined }}>{g.homeRuns || '—'}</td>
              <td>{g.rbi ?? '—'}</td>
              <td>{g.runs ?? '—'}</td>
              <td>{g.walks}</td>
              <td>{g.strikeouts}</td>
              <td>{g.stolenBases || '—'}</td>
              <td className="sdb-td-key" style={{
                color: g.sAvg != null ? (g.sAvg >= 0.300 ? 'var(--color-teal)' : g.sAvg < 0.230 ? '#ef4444' : undefined) : undefined,
              }}>
                {g.sAvg != null ? g.sAvg.toFixed(3).replace('0.', '.') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PitcherLog({ log }: { log: PitcherGameLogEntry[] }) {
  const rows = [...log].reverse().slice(0, 50);
  return (
    <div className="sdb-table-wrap">
      <table className="sdb-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Date</th>
            <th style={{ textAlign: 'left' }}>Opp</th>
            <th>Dec</th><th>IP</th><th>H</th><th>R</th><th>ER</th>
            <th>BB</th><th>K</th><th>HR</th>
            <th className="sdb-th-key">ERA</th>
            <th>K/9</th><th>WHIP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>{g.date?.slice(5) ?? '—'}</td>
              <td style={{ textAlign: 'left', color: 'var(--color-text-secondary)' }}>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10 }}>{g.isHome ? 'vs' : '@'}</span>
                {' '}{g.opponent}
              </td>
              <td style={{ fontWeight: 700, color: g.decision === 'W' ? 'var(--color-teal)' : g.decision === 'L' ? '#ef4444' : undefined }}>
                {g.decision || '—'}
              </td>
              <td style={{ fontWeight: 700 }}>{g.ip.toFixed(1)}</td>
              <td>{g.h}</td>
              <td>{g.runs}</td>
              <td>{g.er}</td>
              <td>{g.bb}</td>
              <td>{g.k}</td>
              <td>{g.hr || '—'}</td>
              <td className="sdb-td-key" style={{ color: g.era <= 3.5 ? 'var(--color-teal)' : g.era >= 5.5 ? '#ef4444' : undefined }}>
                {g.era > 0 ? g.era.toFixed(2) : '—'}
              </td>
              <td>{g.k9 > 0 ? g.k9.toFixed(1) : '—'}</td>
              <td>{g.whip > 0 ? g.whip.toFixed(2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pitch arsenal table ──────────────────────────────────────────────

const PITCH_NAMES: Record<string, string> = {
  FF: 'Four-Seam', SI: 'Sinker', FC: 'Cutter',
  SL: 'Slider', CU: 'Curveball', CH: 'Changeup',
  FS: 'Splitter', KC: 'Knuckle Curve', ST: 'Sweeper', SV: 'Slurve',
};
const PITCH_COLORS: Record<string, string> = {
  FF: '#20b2ff', SI: '#00d4aa', FC: '#a855f7',
  SL: '#f59e0b', CU: '#ef4444', CH: '#22c55e',
  FS: '#fb923c', KC: '#ec4899', ST: '#f97316', SV: '#14b8a6',
};

// ─── Tab type ─────────────────────────────────────────────────────────

type SdbTab = 'batting' | 'statcast' | 'defense' | 'splits' | 'career' | 'gamelog';

// ─── Main page ────────────────────────────────────────────────────────

export default function StatsHubPage() {
  const [searchParams] = useSearchParams();
  const mlbId     = searchParams.get('mlbId') ? parseInt(searchParams.get('mlbId')!, 10) : null;
  const playerName = searchParams.get('name') ?? '';
  const [tab, setTab] = useState<SdbTab>('batting');

  React.useEffect(() => { setTab('batting'); }, [mlbId]);

  const { player: person }                       = usePlayer(mlbId);
  const { stats: hitting,  isLoading: hitLoad }  = useHittingStats(mlbId);
  const { stats: pitching, isLoading: pitLoad }  = usePitchingStats(mlbId);
  const { data: gameLog   = [] }                 = useGameLog(mlbId);
  const { data: pitLog    = [] }                 = usePitcherGameLog(mlbId);
  const { data: defense }                        = useDefenseStats(mlbId);
  const { data: hSplits }                        = useHittingSplits(mlbId);
  const { data: pSplits }                        = usePitchingSplits(mlbId);
  const { data: arsenal   = [] }                 = usePitchArsenal(mlbId);
  const pitchSpin                                = usePitchSpinStats(mlbId);
  const { hitting: careerHit, pitching: careerPit, isLoading: careerLoad } = useCareerStats(mlbId);

  const isLoading = hitLoad || pitLoad;
  const position  = person?.position ?? '';
  const isPitcher = PITCHER_POS.includes(position);
  const hasPit    = isPitcher || (pitching?.games ?? 0) > 0;
  const hasHit    = !isPitcher || (hitting?.games ?? 0) > 0;

  const resolvedName = person?.name ?? playerName;
  React.useEffect(() => {
    document.title = resolvedName ? `${resolvedName} — Stats · The Dugout` : 'Stats Hub · The Dugout';
    return () => { document.title = 'The Dugout · MLB Analytics'; };
  }, [resolvedName]);

  const pitchList = arsenal
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8)
    .map(p => {
      const raw  = p.type as any;
      const code = raw?.code ?? raw?.displayName?.slice(0, 2).toUpperCase() ?? '??';
      return {
        code,
        name:  raw?.displayName ?? PITCH_NAMES[code] ?? code,
        usage: parseFloat((p.percentage * 100).toFixed(1)),
        velo:  p.averageSpeed ?? 0,
        spin:  pitchSpin[code] ?? 0,
      };
    });

  const TABS: { id: SdbTab; label: string; show: boolean }[] = [
    { id: 'batting',  label: hasPit && !hasHit ? 'Pitching' : 'Batting',  show: true      },
    { id: 'statcast', label: 'Statcast',  show: true      },
    { id: 'defense',  label: 'Defense',   show: true      },
    { id: 'splits',   label: 'Splits',    show: true      },
    { id: 'career',   label: 'Career',    show: true      },
    { id: 'gamelog',  label: 'Game Log',  show: true      },
  ];

  return (
    <div className="sdb-page">

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!mlbId && (
        <div className="live-prompt">
          <div className="live-prompt-icon">📊</div>
          <p>Search for any MLB player using the bar above.</p>
          <p className="live-prompt-sub">
            Every available statistic — Standard · Advanced · Statcast · Splits · Career
          </p>
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {mlbId && isLoading && (
        <div className="live-loading-bar">
          <span className="live-loading-dot" />
          Loading all stats for {playerName}…
        </div>
      )}

      {/* ── Player loaded ────────────────────────────────────────────── */}
      {mlbId && !isLoading && (hitting || pitching) && (
        <>
          {/* Player hero */}
          <div className="player-hero">
            <PlayerAvatar mlbId={mlbId} name={resolvedName} size={100} className="player-avatar--hero" />
            <div className="player-hero-info">
              <h2 className="player-hero-name">{resolvedName}</h2>
              <div className="player-hero-meta">
                <Badge variant={isPitcher ? 'accent' : 'green'}>{position || '—'}</Badge>
                {person?.teamName && <span className="player-hero-team">{person.teamName}</span>}
                {person && person.jersey > 0  && <span>#{person.jersey}</span>}
                {person && person.age > 0     && <span>Age {person.age}</span>}
                {person?.bats && person?.throws && <span>B/T: {person.bats}/{person.throws}</span>}
                {person?.height && <span>{person.height}</span>}
                {person && person.weight > 0  && <span>{person.weight} lbs</span>}
              </div>
            </div>

            <div className="sdb-hero-war">
              <span className="sdb-hero-war-value">
                {f(pitching?.war ?? hitting?.war, 1)}
              </span>
              <span className="sdb-hero-war-label">fWAR · {YEAR}</span>
            </div>

            <Link to={`/player?mlbId=${mlbId}&name=${encodeURIComponent(resolvedName)}`}
              className="sdb-profile-link">
              View Profile →
            </Link>
          </div>

          {/* Tab strip */}
          <div className="hub-tabs">
            {TABS.filter(t => t.show).map(t => (
              <button key={t.id}
                className={`hub-tab ${tab === t.id ? 'hub-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              BATTING / PITCHING TAB
          ═══════════════════════════════════════════════════════════ */}
          {tab === 'batting' && (
            <div className="sdb-tab-content">
              {/* ── HITTER ── */}
              {hasHit && hitting && (
                <>
                  <Section title="Standard" color="var(--color-accent)">
                    <S label="G"   value={String(hitting.games)} />
                    <S label="PA"  value={String(hitting.plateAppearances)} />
                    <S label="AB"  value={String(hitting.atBats)} />
                    <S label="H"   value={String(hitting.hits)} />
                    <S label="1B"  value={String(Math.max(0, hitting.hits - hitting.doubles - hitting.triples - hitting.homeRuns))} />
                    <S label="2B"  value={String(hitting.doubles)} />
                    <S label="3B"  value={String(hitting.triples)} />
                    <S label="HR"  value={String(hitting.homeRuns)} color={hitting.homeRuns >= 20 ? '#ef4444' : undefined} />
                    <S label="R"   value={String(hitting.runs)} />
                    <S label="RBI" value={String(hitting.rbi)} />
                    <S label="SB"  value={String(hitting.stolenBases)} color={hitting.stolenBases >= 20 ? 'var(--color-teal)' : undefined} />
                    <S label="BB"  value={String(hitting.walks)} />
                    <S label="SO"  value={String(hitting.strikeouts)} />
                  </Section>

                  <Section title="Rate Stats" color="var(--color-green)">
                    <S label="AVG"   value={avg(hitting.avg)}   color={hitting.avg >= 0.280 ? 'var(--color-teal)' : hitting.avg < 0.220 ? '#ef4444' : undefined} />
                    <S label="OBP"   value={avg(hitting.obp)}   color={hitting.obp >= 0.360 ? 'var(--color-teal)' : hitting.obp < 0.300 ? '#ef4444' : undefined} />
                    <S label="SLG"   value={avg(hitting.slg)}   color={hitting.slg >= 0.500 ? 'var(--color-teal)' : undefined} />
                    <S label="OPS"   value={avg(hitting.ops)}   color={hitting.ops >= 0.850 ? 'var(--color-teal)' : hitting.ops < 0.650 ? '#ef4444' : undefined} />
                    <S label="wOBA"  value={avg(hitting.woba)}  color={hitting.woba >= 0.360 ? 'var(--color-teal)' : hitting.woba < 0.290 ? '#ef4444' : undefined} />
                    <S label="wRC+"  value={hitting.wrcPlus > 0 ? String(hitting.wrcPlus) : '—'} color={hitting.wrcPlus >= 130 ? 'var(--color-teal)' : hitting.wrcPlus < 80 ? '#ef4444' : undefined} sub="100 = avg" />
                    <S label="ISO"   value={avg(hitting.iso)}   color={hitting.iso >= 0.200 ? 'var(--color-teal)' : undefined} />
                    <S label="BABIP" value={avg(hitting.babip)} />
                    <S label="BB%"   value={pct(hitting.bbPct)} color={hitting.bbPct >= 12 ? 'var(--color-teal)' : undefined} />
                    <S label="K%"    value={pct(hitting.kPct)}  color={hitting.kPct >= 30 ? '#ef4444' : hitting.kPct <= 14 ? 'var(--color-teal)' : undefined} />
                    <S label="BB/K"  value={hitting.bbKRatio > 0 ? hitting.bbKRatio.toFixed(2) : '—'} color={hitting.bbKRatio >= 0.50 ? 'var(--color-teal)' : undefined} />
                  </Section>

                  <Section title="Win Probability & Value" color="var(--color-purple)">
                    <S label="WAR"    value={f(hitting.war)}          color={hitting.war >= 4 ? 'var(--color-teal)' : hitting.war < 0 ? '#ef4444' : undefined} sub="FanGraphs" />
                    <S label="WPA"    value={signed(hitting.wpa, 2)}  color={hitting.wpa >= 0 ? 'var(--color-teal)' : '#ef4444'} />
                    <S label="RE24"   value={signed(hitting.re24, 1)} color={hitting.re24 >= 0 ? 'var(--color-teal)' : '#ef4444'} />
                    <S label="Clutch" value={signed(hitting.clutch, 2)} color={hitting.clutch >= 0.5 ? 'var(--color-teal)' : hitting.clutch <= -0.5 ? '#ef4444' : undefined} />
                  </Section>
                </>
              )}

              {/* ── PITCHER ── */}
              {hasPit && pitching && (
                <>
                  <Section title="Standard" color="var(--color-accent)">
                    <S label="G"   value={String(pitching.games)} />
                    <S label="GS"  value={String(pitching.gamesStarted)} />
                    <S label="W"   value={String(pitching.wins)} />
                    <S label="L"   value={String(pitching.losses)} />
                    <S label="SV"  value={pitching.saves > 0 ? String(pitching.saves) : '—'} />
                    <S label="IP"  value={f(pitching.inningsPitched, 1)} />
                    <S label="H"   value="—" />
                    <S label="ER"  value="—" />
                    <S label="BB"  value="—" />
                    <S label="K"   value="—" />
                  </Section>

                  <Section title="Rate Stats" color="var(--color-teal)">
                    <S label="ERA"   value={f(pitching.era, 2)}    color={pitching.era <= 3.00 ? 'var(--color-teal)' : pitching.era >= 5.00 ? '#ef4444' : undefined} />
                    <S label="FIP"   value={f(pitching.fip, 2)}    color={pitching.fip <= 3.20 ? 'var(--color-teal)' : pitching.fip >= 4.80 ? '#ef4444' : undefined} />
                    <S label="xFIP"  value={f(pitching.xfip, 2)}   color={pitching.xfip > 0 && pitching.xfip <= 3.20 ? 'var(--color-teal)' : pitching.xfip >= 4.80 ? '#ef4444' : undefined} />
                    <S label="WHIP"  value={f(pitching.whip, 2)}   color={pitching.whip <= 1.10 ? 'var(--color-teal)' : pitching.whip >= 1.40 ? '#ef4444' : undefined} />
                    <S label="K%"    value={pct(pitching.kPct)}    color={pitching.kPct >= 28 ? 'var(--color-teal)' : pitching.kPct < 16 ? '#ef4444' : undefined} />
                    <S label="BB%"   value={pct(pitching.bbPct)}   color={pitching.bbPct <= 6 ? 'var(--color-teal)' : pitching.bbPct >= 10 ? '#ef4444' : undefined} />
                    <S label="K-BB%" value={pct(pitching.kBBPct)}  color={pitching.kBBPct >= 18 ? 'var(--color-teal)' : pitching.kBBPct < 8 ? '#ef4444' : undefined} />
                    <S label="K/9"   value={f(pitching.k9, 1)}     color={pitching.k9 >= 10 ? 'var(--color-teal)' : undefined} />
                    <S label="BB/9"  value={f(pitching.bb9, 1)}    color={pitching.bb9 <= 2.5 ? 'var(--color-teal)' : pitching.bb9 >= 4.0 ? '#ef4444' : undefined} />
                    <S label="HR/9"  value={f(pitching.hr9, 2)}    color={pitching.hr9 >= 1.5 ? '#ef4444' : pitching.hr9 <= 0.7 ? 'var(--color-teal)' : undefined} />
                    <S label="BABIP" value={avg(pitching.babip)} />
                    <S label="LOB%"  value={pct(pitching.lobPct)}  color={pitching.lobPct >= 78 ? 'var(--color-teal)' : pitching.lobPct < 68 ? '#ef4444' : undefined} />
                    <S label="GB%"   value={pct(pitching.gbPct)}   color={pitching.gbPct >= 50 ? 'var(--color-teal)' : undefined} />
                    <S label="FB%"   value={pct(pitching.fbPct)} />
                    <S label="LD%"   value={pct(pitching.ldPct)} />
                    <S label="IFFB%" value={pct(pitching.iffbPct)} color={pitching.iffbPct >= 12 ? 'var(--color-teal)' : undefined} />
                    <S label="HR/FB" value={pct(pitching.hrFbPct)} color={pitching.hrFbPct >= 13 ? '#ef4444' : pitching.hrFbPct <= 7 ? 'var(--color-teal)' : undefined} />
                  </Section>

                  <Section title="Value" color="var(--color-purple)">
                    <S label="WAR"  value={f(pitching.war)}          color={pitching.war >= 3 ? 'var(--color-teal)' : pitching.war < 0 ? '#ef4444' : undefined} sub="FanGraphs" />
                    <S label="WPA"  value={signed(pitching.wpa, 2)}  color={pitching.wpa >= 0 ? 'var(--color-teal)' : '#ef4444'} />
                    <S label="RE24" value={signed(pitching.re24, 1)} color={pitching.re24 >= 0 ? 'var(--color-teal)' : '#ef4444'} />
                  </Section>

                  {/* Pitch Arsenal */}
                  {pitchList.length > 0 && (
                    <div className="sdb-section">
                      <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>
                        Pitch Arsenal
                      </div>
                      <div className="sdb-table-wrap">
                        <table className="sdb-table">
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
                                    <span style={{
                                      width: 10, height: 10, borderRadius: '50%',
                                      background: PITCH_COLORS[p.code] ?? '#888', flexShrink: 0,
                                    }} />
                                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans, Inter, sans-serif)' }}>
                                      {p.name}
                                    </span>
                                    <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{p.code}</span>
                                  </span>
                                </td>
                                <td style={{ color: PITCH_COLORS[p.code] ?? undefined, fontWeight: 700 }}>{p.usage.toFixed(1)}%</td>
                                <td>{p.velo > 0 ? `${p.velo.toFixed(1)} mph` : '—'}</td>
                                <td>{p.spin > 0 ? p.spin.toLocaleString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STATCAST TAB
          ═══════════════════════════════════════════════════════════ */}
          {tab === 'statcast' && (
            <div className="sdb-tab-content">
              {hasHit && hitting && (
                <>
                  <Section title="Contact Quality" color="var(--color-amber)">
                    <S label="Exit Velo"    value={hitting.exitVelo > 0 ? `${f(hitting.exitVelo, 1)} mph` : '—'} color={hitting.exitVelo >= 92 ? 'var(--color-teal)' : hitting.exitVelo > 0 && hitting.exitVelo < 87 ? '#ef4444' : undefined} />
                    <S label="Launch Angle" value={hitting.launchAngle !== 0 ? `${f(hitting.launchAngle, 1)}°` : '—'} />
                    <S label="Barrel %"     value={hitting.barrelPct > 0 ? pct(hitting.barrelPct) : '—'} color={hitting.barrelPct >= 10 ? 'var(--color-teal)' : hitting.barrelPct > 0 && hitting.barrelPct < 4 ? '#ef4444' : undefined} />
                    <S label="Hard Hit %"   value={hitting.hardHitPct > 0 ? pct(hitting.hardHitPct) : '—'} color={hitting.hardHitPct >= 45 ? 'var(--color-teal)' : hitting.hardHitPct > 0 && hitting.hardHitPct < 30 ? '#ef4444' : undefined} />
                    <S label="Sweet Spot %" value={hitting.sweetSpotPct > 0 ? pct(hitting.sweetSpotPct) : '—'} color={hitting.sweetSpotPct >= 35 ? 'var(--color-teal)' : undefined} />
                    <S label="xwOBA"        value={hitting.woba > 0 ? avg(hitting.woba) : '—'} color={hitting.woba >= 0.360 ? 'var(--color-teal)' : hitting.woba > 0 && hitting.woba < 0.290 ? '#ef4444' : undefined} sub="proxy" />
                  </Section>

                  <Section title="Batted Ball Profile" color="var(--color-green)">
                    <S label="GB%"   value={pct(hitting.gbPct)}        sub="ground ball" />
                    <S label="FB%"   value={pct(hitting.fbPct)}        sub="fly ball" />
                    <S label="LD%"   value={pct(hitting.ldPct)}        color={hitting.ldPct >= 22 ? 'var(--color-teal)' : undefined} sub="line drive" />
                    <S label="Pull%" value={hitting.pullPct > 0 ? pct(hitting.pullPct) : '—'}  sub="pull side" />
                    <S label="Cent%" value={hitting.centPct > 0 ? pct(hitting.centPct) : '—'}  sub="center" />
                    <S label="Oppo%" value={hitting.oppoShotPct > 0 ? pct(hitting.oppoShotPct) : '—'} sub="opposite" />
                  </Section>

                  <Section title="Speed" color="var(--color-teal)">
                    <S label="Sprint Speed" value={hitting.sprint > 0 ? `${f(hitting.sprint, 1)} ft/s` : '—'} color={hitting.sprint >= 27 ? 'var(--color-teal)' : hitting.sprint > 0 && hitting.sprint < 24 ? '#ef4444' : undefined} />
                    <S label="SB"           value={String(hitting.stolenBases)} />
                  </Section>
                </>
              )}

              {hasPit && pitching && (
                <>
                  <Section title="Velocity" color="var(--color-accent)">
                    <S label="Avg Velocity" value={pitching.avgVelocity > 0 ? `${f(pitching.avgVelocity, 1)} mph` : '—'} color={pitching.avgVelocity >= 96 ? 'var(--color-teal)' : pitching.avgVelocity > 0 && pitching.avgVelocity < 90 ? '#ef4444' : undefined} />
                    <S label="Max Velocity" value={pitching.maxVelocity > 0 ? `${f(pitching.maxVelocity, 1)} mph` : '—'} />
                  </Section>

                  <Section title="Swing & Miss" color="var(--color-red, #ef4444)">
                    <S label="Whiff%"  value={pitching.whiffPct > 0 ? pct(pitching.whiffPct) : '—'} color={pitching.whiffPct >= 27 ? 'var(--color-teal)' : pitching.whiffPct > 0 && pitching.whiffPct < 18 ? '#ef4444' : undefined} />
                    <S label="Chase%"  value={pitching.chasePct > 0 ? pct(pitching.chasePct) : '—'} color={pitching.chasePct >= 32 ? 'var(--color-teal)' : undefined} />
                  </Section>
                </>
              )}

              {!hitting?.exitVelo && !pitching?.avgVelocity && (
                <div className="sdb-empty">Statcast data not yet available for this season.</div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              DEFENSE TAB
          ═══════════════════════════════════════════════════════════ */}
          {tab === 'defense' && (
            <div className="sdb-tab-content">
              {defense ? (
                <Section title="Defensive Metrics" color="var(--color-teal)">
                  <S label="Pos"     value={String(defense.pos ?? position)} />
                  <S label="G"       value={String(defense.games)} />
                  <S label="Inn"     value={defense.innings > 0 ? f(defense.innings, 1) : '—'} />
                  <S label="FLD%"    value={defense.fieldingPct > 0 ? defense.fieldingPct.toFixed(3) : '—'} />
                  <S label="E"       value={String(defense.errors)} color={defense.errors >= 10 ? '#ef4444' : undefined} />
                  <S label="A"       value={String(defense.assists)} />
                  <S label="PO"      value={String(defense.putouts)} />
                  <S label="OAA"     value={defense.oaa != null ? signed(defense.oaa, 0) : '—'} color={(defense.oaa ?? 0) > 0 ? 'var(--color-teal)' : (defense.oaa ?? 0) < 0 ? '#ef4444' : undefined} sub="outs above avg" />
                  <S label="DRS"     value={defense.drs != null ? signed(defense.drs, 0) : '—'} color={(defense.drs ?? 0) > 0 ? 'var(--color-teal)' : (defense.drs ?? 0) < 0 ? '#ef4444' : undefined} sub="def runs saved" />
                  {defense.uzr != null && <S label="UZR" value={signed(defense.uzr, 1)} color={(defense.uzr) > 0 ? 'var(--color-teal)' : (defense.uzr) < 0 ? '#ef4444' : undefined} />}
                  {defense.uzr150 != null && <S label="UZR/150" value={signed(defense.uzr150, 1)} color={(defense.uzr150) > 0 ? 'var(--color-teal)' : (defense.uzr150) < 0 ? '#ef4444' : undefined} sub="per 150 games" />}
                  <S label="Rng"     value={defense.rngR != null ? signed(defense.rngR, 1) : '—'} color={(defense.rngR ?? 0) > 0 ? 'var(--color-teal)' : (defense.rngR ?? 0) < 0 ? '#ef4444' : undefined} sub="range runs" />
                  <S label="Err"     value={defense.errR != null ? signed(defense.errR, 1) : '—'} color={(defense.errR ?? 0) > 0 ? 'var(--color-teal)' : (defense.errR ?? 0) < 0 ? '#ef4444' : undefined} sub="error runs" />
                  <S label="ARM"     value={defense.armR != null ? signed(defense.armR, 1) : '—'} color={(defense.armR ?? 0) > 0 ? 'var(--color-teal)' : undefined} sub="arm runs" />
                  {defense.cFraming != null && (
                    <S label="Framing" value={signed(defense.cFraming, 1)} color={(defense.cFraming ?? 0) > 0 ? 'var(--color-teal)' : (defense.cFraming ?? 0) < 0 ? '#ef4444' : undefined} sub="catcher framing" />
                  )}
                </Section>
              ) : (
                <div className="sdb-empty">No defensive data available yet this season.</div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              SPLITS TAB
          ═══════════════════════════════════════════════════════════ */}
          {tab === 'splits' && (
            <div className="sdb-tab-content">
              {hasHit && (
                <div className="sdb-section">
                  <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>
                    Batting Splits
                  </div>
                  <HittingSplitsTable splits={hSplits} />
                </div>
              )}
              {hasPit && (
                <div className="sdb-section">
                  <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-teal)' }}>
                    Pitching Splits
                  </div>
                  <PitchingSplitsTable splits={pSplits} />
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              CAREER TAB
          ═══════════════════════════════════════════════════════════ */}
          {tab === 'career' && (
            <div className="sdb-tab-content">
              {careerLoad && <div className="live-loading-bar"><span className="live-loading-dot" /> Loading career data…</div>}

              {hasPit && careerPit.length > 0 && (
                <div className="sdb-section">
                  <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>
                    Pitching — Year by Year
                  </div>
                  <div className="sdb-table-wrap">
                    <table className="sdb-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Year</th>
                          <th style={{ textAlign: 'left' }}>Team</th>
                          <th>G</th><th>GS</th><th>W</th><th>L</th><th>SV</th><th>IP</th>
                          <th>ERA</th><th>WHIP</th><th>K/9</th><th>BB/9</th>
                          <th>K</th><th>BB</th><th>HR</th>
                          <th className="sdb-th-key">WAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...careerPit].reverse().map((s, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.season}</td>
                            <td style={{ textAlign: 'left', color: 'var(--color-accent)', fontWeight: 600 }}>{s.teamAbbr}</td>
                            <td>{s.g}</td><td>{s.gs}</td><td>{s.w}</td><td>{s.l}</td>
                            <td>{s.sv || '—'}</td>
                            <td>{s.ip.toFixed(1)}</td>
                            <td style={{ color: s.era <= 3.0 ? 'var(--color-teal)' : s.era >= 5.0 ? '#ef4444' : undefined }}>{s.era.toFixed(2)}</td>
                            <td>{s.whip.toFixed(2)}</td>
                            <td>{s.k9.toFixed(1)}</td>
                            <td>{s.bb9.toFixed(1)}</td>
                            <td>{s.k}</td><td>{s.bb}</td><td>{s.hr}</td>
                            <td className="sdb-td-key" style={{ color: s.war >= 3 ? 'var(--color-teal)' : s.war < 0 ? '#ef4444' : undefined }}>
                              {s.war > 0 ? s.war.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {hasHit && careerHit.length > 0 && (
                <div className="sdb-section">
                  <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-green)' }}>
                    Hitting — Year by Year
                  </div>
                  <div className="sdb-table-wrap">
                    <table className="sdb-table">
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left' }}>Year</th>
                          <th style={{ textAlign: 'left' }}>Team</th>
                          <th>G</th><th>PA</th><th>H</th>
                          <th>2B</th><th>3B</th><th>HR</th>
                          <th>R</th><th>RBI</th><th>SB</th><th>BB</th><th>K</th>
                          <th>AVG</th><th>OBP</th><th>SLG</th>
                          <th className="sdb-th-key">OPS</th>
                          <th className="sdb-th-key">WAR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...careerHit].reverse().map((s, i) => (
                          <tr key={i}>
                            <td style={{ textAlign: 'left', fontWeight: 700, color: 'var(--color-text-primary)' }}>{s.season}</td>
                            <td style={{ textAlign: 'left', color: 'var(--color-accent)', fontWeight: 600 }}>{s.teamAbbr}</td>
                            <td>{s.g}</td><td>{s.pa}</td><td>{s.h}</td>
                            <td>{s.doubles}</td><td>{s.triples}</td>
                            <td style={{ color: s.hr >= 20 ? '#ef4444' : undefined }}>{s.hr}</td>
                            <td>{s.r}</td><td>{s.rbi}</td><td>{s.sb}</td>
                            <td>{s.bb || '—'}</td>
                            <td>{s.k  || '—'}</td>
                            <td style={{ color: s.avg >= 0.280 ? 'var(--color-teal)' : s.avg < 0.220 ? '#ef4444' : undefined }}>
                              {s.avg.toFixed(3).replace('0.', '.')}
                            </td>
                            <td>{s.obp.toFixed(3).replace('0.', '.')}</td>
                            <td>{s.slg.toFixed(3).replace('0.', '.')}</td>
                            <td className="sdb-td-key" style={{ color: s.ops >= 0.850 ? 'var(--color-teal)' : s.ops < 0.650 ? '#ef4444' : undefined }}>
                              {s.ops.toFixed(3).replace('0.', '.')}
                            </td>
                            <td className="sdb-td-key" style={{ color: s.war >= 4 ? 'var(--color-teal)' : s.war < 0 ? '#ef4444' : undefined }}>
                              {s.war > 0 ? s.war.toFixed(1) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!careerLoad && careerHit.length === 0 && careerPit.length === 0 && (
                <div className="sdb-empty">No career data available.</div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              GAME LOG TAB
          ═══════════════════════════════════════════════════════════ */}
          {tab === 'gamelog' && (
            <div className="sdb-tab-content">
              {hasHit && gameLog.length > 0 && (
                <div className="sdb-section">
                  <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-green)' }}>
                    Batting Game Log · {YEAR} ({gameLog.length} games)
                  </div>
                  <HitterLog log={gameLog} />
                </div>
              )}
              {hasPit && pitLog.length > 0 && (
                <div className="sdb-section">
                  <div className="sdb-section-header" style={{ borderLeftColor: 'var(--color-accent)' }}>
                    Pitching Game Log · {YEAR} ({pitLog.length} appearances)
                  </div>
                  <PitcherLog log={pitLog} />
                </div>
              )}
              {gameLog.length === 0 && pitLog.length === 0 && (
                <div className="sdb-empty">No game log data available yet this season.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Player not found */}
      {mlbId && !isLoading && !hitting && !pitching && (
        <div className="sdb-empty" style={{ padding: '48px 0' }}>
          No stats found for this player this season.
        </div>
      )}
    </div>
  );
}
