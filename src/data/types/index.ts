// ─── Core Baseball Types ────────────────────────────────────────────

export type Position = 'P' | 'SP' | 'RP' | 'CL' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
export type HandType = 'R' | 'L' | 'S';
export type League = 'AL' | 'NL';
export type Division = 'East' | 'Central' | 'West';

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  league: League;
  division: Division;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  record: { wins: number; losses: number };
  payroll: number; // millions
}

export interface Player {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  teamId: string;
  teamName?: string;
  teamAbbr?: string;
  isFreeAgent?: boolean;
  position: Position;
  bats: HandType;
  throws: HandType;
  age: number;
  draftYear: number;
  yearsService: number;
  salary: number; // millions
  contractYears: number;
  contractTotal: number; // millions
  war: number;
  warProjected: number;
  headshot?: string;
  jersey: number;
  nationality: string;
  height: string;
  weight: number;
  birthdate: string;
}

// ─── Pitching Stats ─────────────────────────────────────────────────

export interface PitchingStats {
  playerId: string;
  season: number;
  games: number;
  gamesStarted: number;
  inningsPitched: number;
  wins: number;
  losses: number;
  saves: number;
  era: number;
  fip: number;
  xfip: number;
  whip: number;
  k9: number;
  bb9: number;
  hr9: number;
  kPct: number;
  bbPct: number;
  kBBPct: number;
  babip: number;
  lobPct: number;
  gbPct: number;
  fbPct: number;
  ldPct: number;
  hrFbPct: number;
  avgVelocity: number;
  maxVelocity: number;
  whiffPct: number;
  chasePct: number;
  war: number;
  wpa: number;
  re24: number;
}

export interface PitchType {
  name: string;
  abbreviation: string;
  usage: number; // percentage
  avgVelo: number;
  spinRate: number;
  whiffPct: number;
  chasePct: number;
  putawayPct: number;
  avgBreakH: number;
  avgBreakV: number;
  runValue: number;
}

export interface VelocityTrend {
  date: string;
  avgVelo: number;
  maxVelo: number;
  gameIndex: number;
}

// ─── Hitting Stats ───────────────────────────────────────────────────

export interface HittingStats {
  playerId: string;
  season: number;
  games: number;
  plateAppearances: number;
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  runs: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  woba: number;
  wrcPlus: number;
  iso: number;
  babip: number;
  kPct: number;
  bbPct: number;
  bbKRatio: number;
  exitVelo: number;
  launchAngle: number;
  barrelPct: number;
  hardHitPct: number;
  sweetSpotPct: number;
  gbPct: number;
  fbPct: number;
  ldPct: number;
  pullPct: number;
  centPct: number;
  oppoShotPct: number;
  clutch: number;
  war: number;
  wpa: number;
  re24: number;
  sprint: number;
  outs: number;
  whiffPct: number;
  chasePct: number;
}

// ─── Clutch Analytics ────────────────────────────────────────────────

export interface ClutchStats {
  playerId: string;
  season: number;
  highLeverageWoba: number;
  highLeverageOps: number;
  highLeverageK: number;
  rispAvg: number;
  rispOps: number;
  lateInningAvg: number;
  lateInningOps: number;
  tieGameWoba: number;
  clutchScore: number;
  clutchRank: number;
  highLeveragePA: number;
  gameWinningRbi: number;
  walkOffHits: number;
  closeSituationWar: number;
}

// ─── Defensive Stats ─────────────────────────────────────────────────

export interface DefensiveStats {
  playerId: string;
  season: number;
  position: Position;
  games: number;
  innings: number;
  fieldingPct: number;
  errors: number;
  assists: number;
  putouts: number;
  oaa: number;
  drs: number;
  uzr: number;
  uzr150: number;
  rngR: number;
  errR: number;
  armR: number;
  dpR: number;
  armStrength?: number;
  firstStep?: number;
  maxSpeed?: number;
  framing?: number;
  blockingPct?: number;
  popTime?: number;
  catcherEra?: number;
}

// ─── Trade Types ─────────────────────────────────────────────────────

export interface TradePlayer {
  player: Player;
  pitching?: PitchingStats;
  hitting?: HittingStats;
  defense?: DefensiveStats;
}

export interface TradeSide {
  teamId: string;
  players: TradePlayer[];
  prospects?: string[];
  cashConsiderations: number;
}

export interface TradeAnalysis {
  side1: TradeSide;
  side2: TradeSide;
  fairnessScore: number; // -100 to +100
  warDelta: number;
  payrollDelta: number;
  verdict: string;
  insights: string[];
  winnerTeam?: string;
}

// ─── Leaderboard ──────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  player: Player;
  team: Team;
  value: number;
  secondary?: number;
  trend: 'up' | 'down' | 'flat';
  trendValue?: number;
}

// ─── Visualization Data ──────────────────────────────────────────────

export interface HeatmapZone {
  row: number;
  col: number;
  value: number;
  label?: string;
}

export interface SprayChartPoint {
  x: number;
  y: number;
  type: 'single' | 'double' | 'triple' | 'hr' | 'out';
  speed?: number;
  angle?: number;
}

export interface PercentileBar {
  label: string;
  value: number;  // 0–100
  raw?: number;
  color?: string;
}

export interface TrendPoint {
  date: string;
  value: number;
  label?: string;
  gameId?: string;
}
