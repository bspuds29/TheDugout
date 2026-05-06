/**
 * Transformers: raw MLB Stats API / Savant responses → app TypeScript interfaces
 * These functions are the single source of truth for data shape normalization.
 */

import type { Player, Team, PitchingStats, HittingStats } from '../../types';
import type {
  RawMLBPerson,
  RawMLBTeam,
  RawMLBPitchingStat,
  RawMLBHittingStat,
  RawMLBSabermetricsstat,
} from '../mlbStats';
import type { SavantBatterStats, SavantPitcherStats } from '../savant';

// ─── Helpers ──────────────────────────────────────────────────────────

function safeNum(v: string | number | undefined, fallback = 0): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function parseIP(ip: string): number {
  // "180.1" → 180.333 actual innings
  const [whole, frac] = ip.split('.');
  return parseInt(whole, 10) + (parseInt(frac ?? '0', 10) / 3);
}

function leagueName(name: string): 'AL' | 'NL' {
  if (name?.includes('American')) return 'AL';
  if (name?.includes('National')) return 'NL';
  return 'AL';
}

function divisionName(name: string): 'East' | 'Central' | 'West' {
  if (name?.includes('East')) return 'East';
  if (name?.includes('Central')) return 'Central';
  return 'West';
}

// ─── Team transformer ─────────────────────────────────────────────────

export function transformTeam(raw: RawMLBTeam): Team {
  return {
    id: String(raw.id),
    name: raw.name,
    abbreviation: raw.abbreviation,
    city: raw.locationName ?? '',
    league: leagueName(raw.league?.name ?? ''),
    division: divisionName(raw.division?.name ?? ''),
    logo: `https://www.mlbstatic.com/team-logos/${raw.id}.svg`,
    primaryColor: '#1a2332',    // fallback — no color in API
    secondaryColor: '#20b2ff',
    record: {
      wins: raw.record?.wins ?? 0,
      losses: raw.record?.losses ?? 0,
    },
    payroll: 0, // not in MLB Stats API
  };
}

// ─── Player transformer ───────────────────────────────────────────────

export function transformPerson(raw: RawMLBPerson): Player {
  const pos = raw.primaryPosition?.abbreviation ?? 'DH';
  // All pitchers (SP, RP, CL, TWP) are displayed as "P" in the profile badge
  const normalizedPos = (['SP', 'RP', 'CL', 'TWP', 'P'].includes(pos) ? 'P' : pos) as Player['position'];

  // Detect free agents: most recent roster entry has status code 'FA' and is inactive
  const latestEntry = raw.rosterEntries?.[0];
  const isFreeAgent = latestEntry
    ? latestEntry.status?.code === 'FA' && !latestEntry.isActive
    : false;

  return {
    id: String(raw.id),
    name: raw.fullName,
    firstName: raw.firstName,
    lastName: raw.lastName,
    teamId: String(raw.currentTeam?.id ?? ''),
    teamName: raw.currentTeam?.name,
    teamAbbr: raw.currentTeam?.abbreviation,
    isFreeAgent,
    position: normalizedPos,
    bats: (raw.batSide?.code ?? 'R') as Player['bats'],
    throws: (raw.pitchHand?.code ?? 'R') as Player['throws'],
    age: raw.currentAge ?? 0,
    draftYear: 0,          // not in this endpoint
    yearsService: 0,
    salary: 0,             // not in Stats API
    contractYears: 1,
    contractTotal: 0,
    war: 0,                // populated from FanGraphs / Savant later
    warProjected: 0,
    jersey: parseInt(raw.primaryNumber ?? '0', 10),
    nationality: raw.birthCountry ?? '',
    height: raw.height ?? '',
    weight: raw.weight ?? 0,
    birthdate: raw.birthDate ?? '',
  };
}

// ─── Pitching stats transformer ───────────────────────────────────────

export function transformPitchingStats(
  raw: RawMLBPitchingStat,
  mlbId: number,
  season: number,
  savant?: SavantPitcherStats | null,
  saber?: RawMLBSabermetricsstat | null
): PitchingStats {
  const ip = parseIP(raw.inningsPitched ?? '0');
  const bf = raw.battersFaced ?? 1;
  const kPct = bf > 0 ? (raw.strikeOuts / bf) * 100 : 0;
  const bbPct = bf > 0 ? (raw.baseOnBalls / bf) * 100 : 0;

  return {
    playerId: String(mlbId),
    season,
    games: raw.gamesPlayed ?? 0,
    gamesStarted: raw.gamesStarted ?? 0,
    inningsPitched: ip,
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
    saves: raw.saves ?? 0,
    era: safeNum(raw.era),
    fip: 0,               // not in MLB Stats API; Savant xFIP used instead
    xfip: savant ? savant.xera : 0,
    whip: safeNum(raw.whip),
    k9: ip > 0 ? (raw.strikeOuts / ip) * 9 : 0,
    bb9: ip > 0 ? (raw.baseOnBalls / ip) * 9 : 0,
    hr9: ip > 0 ? (raw.homeRuns / ip) * 9 : 0,
    kPct: Math.round(kPct * 10) / 10,
    bbPct: Math.round(bbPct * 10) / 10,
    kBBPct: Math.round((kPct - bbPct) * 10) / 10,
    babip: 0,
    lobPct: 0,
    gbPct: savant?.gbPct ?? 0,
    fbPct: savant?.fbPct ?? 0,
    ldPct: savant?.ldPct ?? 0,
    iffbPct: 0,
    hrFbPct: 0,
    avgVelocity: savant?.fastballVelo ?? 0,
    maxVelocity: savant?.maxVelocity ?? 0,
    whiffPct: savant?.whiffPct ?? 0,
    chasePct: savant?.chasePct ?? 0,
    war:  saber?.war  ? Math.round(saber.war  * 10) / 10 : 0,
    wpa: 0,
    re24: 0,
  };
}

// ─── Hitting stats transformer ────────────────────────────────────────

export function transformHittingStats(
  raw: RawMLBHittingStat,
  mlbId: number,
  season: number,
  savant?: SavantBatterStats | null,
  saber?: RawMLBSabermetricsstat | null
): HittingStats {
  const pa = raw.plateAppearances ?? 1;
  const kPct = pa > 0 ? (raw.strikeOuts / pa) * 100 : 0;
  const bbPct = pa > 0 ? (raw.baseOnBalls / pa) * 100 : 0;

  return {
    playerId: String(mlbId),
    season,
    games: raw.gamesPlayed ?? 0,
    plateAppearances: raw.plateAppearances ?? 0,
    atBats: raw.atBats ?? 0,
    hits: raw.hits ?? 0,
    doubles: raw.doubles ?? 0,
    triples: raw.triples ?? 0,
    homeRuns: raw.homeRuns ?? 0,
    rbi: raw.rbi ?? 0,
    runs: raw.runs ?? 0,
    walks: raw.baseOnBalls ?? 0,
    strikeouts: raw.strikeOuts ?? 0,
    stolenBases: raw.stolenBases ?? 0,
    avg: safeNum(raw.avg),
    obp: safeNum(raw.obp),
    slg: safeNum(raw.slg),
    ops: safeNum(raw.ops),
    // wOBA: prefer sabermetrics group, fall back to Savant, then 0
    woba: saber?.wOBA ?? savant?.woba ?? 0,
    wrcPlus: saber?.wRCPlus ? Math.round(saber.wRCPlus) : 0,
    iso: safeNum(raw.slg) - safeNum(raw.avg),
    babip: safeNum(raw.babip),
    kPct: Math.round(kPct * 10) / 10,
    bbPct: Math.round(bbPct * 10) / 10,
    bbKRatio: raw.strikeOuts > 0
      ? Math.round((raw.baseOnBalls / raw.strikeOuts) * 100) / 100
      : 0,
    exitVelo: savant?.exitVelo ?? 0,
    launchAngle: savant?.launchAngle ?? 0,
    barrelPct: savant?.barrelPct ?? 0,
    hardHitPct: savant?.hardHitPct ?? 0,
    sweetSpotPct: savant?.sweetSpotPct ?? 0,
    gbPct:      savant?.gbPct      ?? 0,
    fbPct:      savant?.fbPct      ?? 0,
    ldPct:      savant?.ldPct      ?? 0,
    pullPct:    savant?.pullPct    ?? 0,
    centPct:    savant?.straightPct ?? 0,
    oppoShotPct:savant?.oppoPct    ?? 0,
    clutch: 0,
    war: saber?.war ? Math.round(saber.war * 10) / 10 : 0,
    wpa: 0,
    re24: 0,
    sprint: savant?.sprintSpeed ?? 0,
    outs: raw.airOuts ?? 0,
    whiffPct: 0,
    chasePct: 0,
  };
}

// ─── Percentile calculator (vs league) ───────────────────────────────

/**
 * Given a player's stat value and an array of all player values for that stat,
 * returns what percentile (0–99) the player is at.
 */
export function calcPercentile(value: number, allValues: number[]): number {
  if (!allValues.length) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return Math.round((below / sorted.length) * 100);
}

/**
 * Reverse percentile for stats where lower is better (ERA, BB%, etc.).
 */
export function calcInversePercentile(value: number, allValues: number[]): number {
  return 100 - calcPercentile(value, allValues);
}
