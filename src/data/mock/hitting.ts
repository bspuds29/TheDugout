import type { HittingStats, HeatmapZone, SprayChartPoint, TrendPoint } from '../types';

export const HITTING_STATS: HittingStats[] = [
  {
    playerId: 'h001',
    season: 2025,
    games: 148,
    plateAppearances: 641,
    atBats: 558,
    hits: 178,
    doubles: 38,
    triples: 7,
    homeRuns: 28,
    rbi: 84,
    runs: 104,
    walks: 72,
    strikeouts: 118,
    stolenBases: 24,
    avg: 0.319,
    obp: 0.403,
    slg: 0.558,
    ops: 0.961,
    woba: 0.394,
    wrcPlus: 156,
    iso: 0.239,
    babip: 0.348,
    kPct: 18.4,
    bbPct: 11.2,
    bbKRatio: 0.61,
    exitVelo: 91.8,
    launchAngle: 14.2,
    barrelPct: 12.8,
    hardHitPct: 48.4,
    sweetSpotPct: 34.8,
    gbPct: 38.4,
    fbPct: 38.8,
    ldPct: 22.8,
    pullPct: 44.2,
    centPct: 32.8,
    oppoShotPct: 23.0,
    clutch: 1.42,
    war: 7.1,
    wpa: 4.21,
    re24: 48.4,
    sprint: 28.8,
    outs: 380,
  },
  {
    playerId: 'h002',
    season: 2025,
    games: 142,
    plateAppearances: 598,
    atBats: 519,
    hits: 162,
    doubles: 34,
    triples: 1,
    homeRuns: 38,
    rbi: 112,
    runs: 89,
    walks: 68,
    strikeouts: 138,
    stolenBases: 2,
    avg: 0.312,
    obp: 0.391,
    slg: 0.588,
    ops: 0.979,
    woba: 0.388,
    wrcPlus: 152,
    iso: 0.276,
    babip: 0.328,
    kPct: 23.1,
    bbPct: 11.4,
    bbKRatio: 0.49,
    exitVelo: 94.2,
    launchAngle: 18.8,
    barrelPct: 18.4,
    hardHitPct: 54.8,
    sweetSpotPct: 38.4,
    gbPct: 31.2,
    fbPct: 48.4,
    ldPct: 20.4,
    pullPct: 48.8,
    centPct: 28.4,
    oppoShotPct: 22.8,
    clutch: 0.84,
    war: 5.6,
    wpa: 3.18,
    re24: 38.2,
    sprint: 26.2,
    outs: 357,
  },
  {
    playerId: 'h004',
    season: 2025,
    games: 139,
    plateAppearances: 584,
    atBats: 508,
    hits: 161,
    doubles: 32,
    triples: 5,
    homeRuns: 22,
    rbi: 78,
    runs: 98,
    walks: 65,
    strikeouts: 102,
    stolenBases: 31,
    avg: 0.317,
    obp: 0.398,
    slg: 0.521,
    ops: 0.919,
    woba: 0.378,
    wrcPlus: 147,
    iso: 0.204,
    babip: 0.341,
    kPct: 17.5,
    bbPct: 11.1,
    bbKRatio: 0.64,
    exitVelo: 89.4,
    launchAngle: 12.8,
    barrelPct: 10.4,
    hardHitPct: 44.2,
    sweetSpotPct: 32.1,
    gbPct: 42.8,
    fbPct: 34.2,
    ldPct: 23.0,
    pullPct: 40.2,
    centPct: 36.8,
    oppoShotPct: 23.0,
    clutch: 1.18,
    war: 5.3,
    wpa: 2.94,
    re24: 34.8,
    sprint: 30.4,
    outs: 347,
  },
  {
    playerId: 'h003',
    season: 2025,
    games: 151,
    plateAppearances: 631,
    atBats: 548,
    hits: 158,
    doubles: 36,
    triples: 3,
    homeRuns: 31,
    rbi: 101,
    runs: 94,
    walks: 71,
    strikeouts: 142,
    stolenBases: 7,
    avg: 0.288,
    obp: 0.373,
    slg: 0.528,
    ops: 0.901,
    woba: 0.368,
    wrcPlus: 141,
    iso: 0.240,
    babip: 0.304,
    kPct: 22.5,
    bbPct: 11.3,
    bbKRatio: 0.50,
    exitVelo: 92.8,
    launchAngle: 16.4,
    barrelPct: 14.2,
    hardHitPct: 50.4,
    sweetSpotPct: 36.8,
    gbPct: 36.8,
    fbPct: 42.4,
    ldPct: 20.8,
    pullPct: 46.4,
    centPct: 30.4,
    oppoShotPct: 23.2,
    clutch: -0.42,
    war: 4.9,
    wpa: 2.74,
    re24: 31.4,
    sprint: 26.8,
    outs: 390,
  },
];

// ─── Heatmap Zones (9x9 grid) ────────────────────────────────────────

export const generateHeatmap = (playerId: string): HeatmapZone[] => {
  const baseValues: Record<string, number[][]> = {
    h001: [
      [0.22, 0.28, 0.18, 0.20, 0.25, 0.18, 0.16, 0.22, 0.14],
      [0.25, 0.31, 0.28, 0.32, 0.38, 0.28, 0.22, 0.28, 0.18],
      [0.28, 0.38, 0.42, 0.48, 0.52, 0.42, 0.32, 0.34, 0.22],
      [0.24, 0.42, 0.52, 0.64, 0.68, 0.54, 0.38, 0.38, 0.24],
      [0.20, 0.38, 0.48, 0.58, 0.62, 0.48, 0.34, 0.32, 0.20],
      [0.18, 0.30, 0.40, 0.48, 0.52, 0.40, 0.28, 0.28, 0.18],
      [0.15, 0.24, 0.30, 0.36, 0.38, 0.30, 0.22, 0.22, 0.15],
      [0.12, 0.18, 0.22, 0.24, 0.26, 0.22, 0.16, 0.16, 0.12],
      [0.10, 0.14, 0.16, 0.18, 0.20, 0.16, 0.12, 0.12, 0.10],
    ],
    h002: [
      [0.18, 0.24, 0.28, 0.28, 0.30, 0.28, 0.28, 0.24, 0.18],
      [0.22, 0.32, 0.38, 0.38, 0.40, 0.38, 0.38, 0.32, 0.22],
      [0.24, 0.40, 0.50, 0.52, 0.54, 0.52, 0.50, 0.40, 0.24],
      [0.22, 0.44, 0.58, 0.68, 0.70, 0.68, 0.58, 0.44, 0.22],
      [0.18, 0.40, 0.54, 0.64, 0.68, 0.64, 0.54, 0.40, 0.18],
      [0.16, 0.32, 0.44, 0.52, 0.54, 0.52, 0.44, 0.32, 0.16],
      [0.14, 0.26, 0.34, 0.40, 0.42, 0.40, 0.34, 0.26, 0.14],
      [0.12, 0.20, 0.24, 0.28, 0.30, 0.28, 0.24, 0.20, 0.12],
      [0.10, 0.14, 0.16, 0.18, 0.18, 0.18, 0.16, 0.14, 0.10],
    ],
  };

  const grid = baseValues[playerId] ?? baseValues['h001'];
  const zones: HeatmapZone[] = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      zones.push({
        row,
        col,
        value: grid[row]?.[col] ?? 0.25 + (Math.random() - 0.5) * 0.2,
      });
    }
  }
  return zones;
};

// ─── Spray Chart Points ──────────────────────────────────────────────

export const generateSpray = (playerId: string): SprayChartPoint[] => {
  const isLefty = playerId === 'h002';
  return Array.from({ length: 120 }, () => {
    const angle = (isLefty ? 190 : 150) + Math.random() * 80;
    const dist = 200 + Math.random() * 230;
    const rad = (angle * Math.PI) / 180;
    const x = 250 + dist * Math.cos(rad);
    const y = 300 - dist * Math.sin(rad);
    const rand = Math.random();
    const type = rand < 0.62 ? 'out' : rand < 0.76 ? 'single' : rand < 0.86 ? 'double' : rand < 0.92 ? 'hr' : 'triple';
    return { x, y, type, speed: 70 + Math.random() * 40, angle };
  });
};

// ─── Rolling Trends ──────────────────────────────────────────────────

export const generateWobaTrend = (playerId: string): TrendPoint[] => {
  const base = playerId === 'h001' ? 0.394 : playerId === 'h002' ? 0.388 : 0.368;
  return Array.from({ length: 26 }, (_, i) => ({
    date: `Week ${i + 1}`,
    value: Math.max(0.2, Math.min(0.55, base + (Math.random() - 0.5) * 0.06 + (i > 14 ? 0.015 : -0.01))),
    label: `${(base + (Math.random() - 0.5) * 0.05).toFixed(3)}`,
  }));
};

export const getHittingStats = (playerId: string, season = 2025) =>
  HITTING_STATS.find(s => s.playerId === playerId && s.season === season);
