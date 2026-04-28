/**
 * Data-informed visual generators
 *
 * These replace the purely random mock generators with versions seeded by
 * real player stats. Results are deterministic for a given player so the
 * charts don't flicker on re-render.
 */

import type { HeatmapZone, SprayChartPoint, TrendPoint } from '../types';
import type { GameLogEntry } from './mlbStats';
import type { HittingStats } from '../types';

// ─── Simple deterministic seeded RNG ─────────────────────────────────

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── wOBA Rolling Trend (real game log data) ─────────────────────────

const WOBA_WEIGHTS = {
  bb:  0.69,
  hbp: 0.72,
  s1:  0.89,
  d:   1.27,
  t:   1.62,
  hr:  2.10,
};

function gameWoba(g: GameLogEntry): number | null {
  const denom =
    g.atBats + g.walks - g.intentionalWalks + g.sacFlies + g.hitByPitch;
  if (denom === 0) return null;
  const numer =
    WOBA_WEIGHTS.bb  * (g.walks - g.intentionalWalks) +
    WOBA_WEIGHTS.hbp * g.hitByPitch +
    WOBA_WEIGHTS.s1  * g.singles +
    WOBA_WEIGHTS.d   * g.doubles +
    WOBA_WEIGHTS.t   * g.triples +
    WOBA_WEIGHTS.hr  * g.homeRuns;
  return numer / denom;
}

/**
 * Build a rolling-average wOBA trend from a game log.
 * Uses a 10-game window so noise is smoothed without losing shape.
 */
export function buildWobaTrend(
  gameLog: GameLogEntry[],
  windowSize = 10
): TrendPoint[] {
  if (!gameLog.length) return [];

  const points: TrendPoint[] = [];

  for (let i = 0; i < gameLog.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = gameLog.slice(start, i + 1);

    // Aggregate the window
    const agg = window.reduce(
      (acc, g) => ({
        atBats:           acc.atBats           + g.atBats,
        hits:             acc.hits             + g.hits,
        singles:          acc.singles          + g.singles,
        doubles:          acc.doubles          + g.doubles,
        triples:          acc.triples          + g.triples,
        homeRuns:         acc.homeRuns         + g.homeRuns,
        walks:            acc.walks            + g.walks,
        intentionalWalks: acc.intentionalWalks + g.intentionalWalks,
        hitByPitch:       acc.hitByPitch       + g.hitByPitch,
        sacFlies:         acc.sacFlies         + g.sacFlies,
        strikeouts:       acc.strikeouts       + g.strikeouts,
        date:             g.date,
      }),
      { atBats:0, hits:0, singles:0, doubles:0, triples:0, homeRuns:0,
        walks:0, intentionalWalks:0, hitByPitch:0, sacFlies:0, strikeouts:0, date:'' }
    );

    const w = gameWoba(agg);
    if (w !== null) {
      const label = gameLog[i].date
        ? gameLog[i].date.slice(5)   // "MM-DD"
        : `G${i + 1}`;
      points.push({
        date:  label,
        value: Math.round(w * 1000) / 1000,
        label: label,
      });
    }
  }

  return points;
}

// ─── Spray Chart (data-informed) ─────────────────────────────────────

/**
 * Generate spray chart points seeded by real season stats.
 *
 * Approach:
 * - Total batted balls ≈ AB (everything that wasn't a BB/HBP/K)
 * - Distribute by actual HR/3B/2B/1B/out counts
 * - Use batter handedness to determine pull direction
 * - Scatter within zones that match each result type
 */
export function buildSprayChart(
  stats: HittingStats,
  bats: 'R' | 'L' | 'S',
  mlbId: number
): SprayChartPoint[] {
  const rng = seeded(mlbId + stats.homeRuns * 7 + stats.hits * 3);

  const hrs     = stats.homeRuns;
  const triples = stats.triples;
  const doubles = stats.doubles;
  const singles = Math.max(0, stats.hits - hrs - triples - doubles);
  const outs    = Math.max(0, stats.atBats - stats.hits);

  // Clamp total points to a reasonable display number
  const totalBBE = Math.min(
    hrs + triples + doubles + singles + outs,
    500
  );
  const scale    = totalBBE / (hrs + triples + doubles + singles + outs || 1);

  const counts = {
    hr:     Math.round(hrs     * scale),
    triple: Math.round(triples * scale),
    double: Math.round(doubles * scale),
    single: Math.round(singles * scale),
    out:    0,
  };
  counts.out = totalBBE - counts.hr - counts.triple - counts.double - counts.single;

  // Field zones — (cx, cy, xSpread, ySpread)
  // SVG field: home plate ~(250,378), LF wall ~(30,130), RF wall ~(470,130), CF ~(250,30)
  // isLeftPull: RHB pulls to left, LHB pulls to right
  const pullLeft = bats === 'R' || bats === 'S';

  // Wall geometry: the SVG arc "A260 260 0 0 1" from (20,160)→(480,160)
  // is a circle of radius 260 whose centre lands at (250, 281).
  // Proof: midpoint of chord = (250,160), half-chord = 230,
  //   h = √(260²−230²) ≈ 121 → centre at (250, 160+121) = (250, 281).
  // The arc bows upward through (250, 21) — that is the outfield wall.
  // A point is INSIDE the field when dist(pt, (250,281)) < 260.
  // HRs must land OUTSIDE (dist ≥ 265 from arc centre).
  const WALL_CX = 250, WALL_CY = 281, WALL_R = 260, HR_MIN_R = 265;

  function pushOutsideWall(x: number, y: number): { x: number; y: number } {
    const dx = x - WALL_CX;
    const dy = y - WALL_CY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < HR_MIN_R) {
      const scale = HR_MIN_R / dist;
      return { x: WALL_CX + dx * scale, y: WALL_CY + dy * scale };
    }
    return { x, y };
  }

  // ── Zone layout ───────────────────────────────────────────────────────
  // SVG canvas: 500×420.  Home plate (250,380), bases at 1B(330,290)
  // 2B(250,200) 3B(170,290).  Outfield wall corners (20,160)/(480,160);
  // CF top of arc ≈ (250,21).  Four depth tiers:
  //   Infield      y ≈ 255–370  (dirt, grass infield)
  //   Shallow OF   y ≈ 215–250  (just over infielders' heads)
  //   Medium OF    y ≈ 170–215  (normal outfield range)
  //   Deep OF      y ≈ 140–170  (warning track / gap)
  //   HR           y <  140     (over the wall)

  const zones = {
    // ── Infield (ground balls, weak contact, infield singles) ──────────
    ifGb: pullLeft
      ? { cx: 188, cy: 308, xs: 72, ys: 52 }
      : { cx: 312, cy: 308, xs: 72, ys: 52 },

    // ── Shallow outfield (bloopers, seeing-eye hits) ────────────────────
    shallowPull: pullLeft
      ? { cx: 148, cy: 232, xs: 42, ys: 28 }
      : { cx: 352, cy: 232, xs: 42, ys: 28 },
    shallowOppo: pullLeft
      ? { cx: 352, cy: 232, xs: 42, ys: 28 }
      : { cx: 148, cy: 232, xs: 42, ys: 28 },
    shallowCenter: { cx: 250, cy: 222, xs: 58, ys: 28 },

    // ── Medium outfield (line-drive singles, routine fly outs) ──────────
    pullGap: pullLeft
      ? { cx: 108, cy: 196, xs: 44, ys: 34 }
      : { cx: 392, cy: 196, xs: 44, ys: 34 },
    oppoGap: pullLeft
      ? { cx: 392, cy: 196, xs: 44, ys: 34 }
      : { cx: 108, cy: 196, xs: 44, ys: 34 },
    center: { cx: 250, cy: 182, xs: 58, ys: 36 },

    // ── Deep outfield (doubles, warning-track fly outs) ─────────────────
    deepPull: pullLeft
      ? { cx: 68, cy: 163, xs: 34, ys: 18 }
      : { cx: 432, cy: 163, xs: 34, ys: 18 },
    deepOppo: pullLeft
      ? { cx: 432, cy: 163, xs: 34, ys: 18 }
      : { cx: 68, cy: 163, xs: 34, ys: 18 },
    deepCenter: { cx: 250, cy: 148, xs: 52, ys: 22 },

    // ── HR zones (over/beyond the wall) ────────────────────────────────
    // Large spread so HRs scatter naturally along the wall rather than
    // clustering at a single point.  pushOutsideWall() corrects any dot
    // that drifts back inside the arc.
    hrPull: pullLeft
      ? { cx: 75,  cy: 118, xs: 80, ys: 50 }   // LF seats (RHB pull)
      : { cx: 425, cy: 118, xs: 80, ys: 50 },   // RF seats (LHB pull)
    hrCenter: { cx: 250, cy: 65, xs: 90, ys: 45 },  // CF / CF-gap
    hrOppo: pullLeft
      ? { cx: 420, cy: 118, xs: 70, ys: 45 }    // RF (RHB oppo)
      : { cx: 80,  cy: 118, xs: 70, ys: 45 },   // LF (LHB oppo)
  };

  const points: SprayChartPoint[] = [];

  function scatter(
    zone: { cx: number; cy: number; xs: number; ys: number },
    type: SprayChartPoint['type'],
    n: number
  ) {
    const isHR = type === 'hr';
    for (let i = 0; i < n; i++) {
      const u1 = rng(), u2 = rng();
      const z0 = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
      const z1 = Math.sqrt(-2 * Math.log(u2 + 1e-10)) * Math.sin(2 * Math.PI * u1);
      let x = Math.max(10, Math.min(490, zone.cx + z0 * zone.xs * 0.5));
      let y = Math.max(15, Math.min(375, zone.cy + z1 * zone.ys * 0.5));
      if (isHR) {
        const clamped = pushOutsideWall(x, y);
        x = Math.max(15, Math.min(485, clamped.x));
        y = Math.max(20, Math.min(155, clamped.y));
      }
      points.push({ x, y, type });
    }
  }

  // ── Directional fractions from real pull/center/oppo stats ───────────
  // Use the player's actual batted-ball direction percentages when the API
  // has returned them (sum > 50 means they're populated).  Fall back to a
  // neutral split only if the data is missing.
  const dirSum = (stats.pullPct ?? 0) + (stats.centPct ?? 0) + (stats.oppoShotPct ?? 0);
  const hasDirStats = dirSum > 50;
  const pullFrac  = hasDirStats ? (stats.pullPct      ?? 0) / dirSum : 0.45;
  const centerFrac = hasDirStats ? (stats.centPct      ?? 0) / dirSum : 0.30;
  const oppoFrac  = hasDirStats ? (stats.oppoShotPct  ?? 0) / dirSum : 0.25;

  // Outs are not displayed — skip scattering them.

  // Singles: shallow → medium outfield + a handful of infield hits
  const singleOF = Math.round(counts.single * 0.88);
  const singleIF = counts.single - singleOF;
  scatter(zones.shallowPull,   'single', Math.round(singleOF * pullFrac   * 0.6));
  scatter(zones.pullGap,       'single', Math.round(singleOF * pullFrac   * 0.4));
  scatter(zones.shallowCenter, 'single', Math.round(singleOF * centerFrac));
  scatter(zones.shallowOppo,   'single', Math.round(singleOF * oppoFrac   * 0.6));
  scatter(zones.oppoGap,       'single', Math.round(singleOF * oppoFrac   * 0.4));
  scatter(zones.ifGb,          'single', singleIF);

  // Doubles: deep gaps and deep center (warning-track territory)
  scatter(zones.deepPull,   'double', Math.round(counts.double * pullFrac));
  scatter(zones.deepCenter, 'double', Math.round(counts.double * centerFrac));
  scatter(zones.deepOppo,   'double', Math.round(counts.double * oppoFrac));

  // Triples: very deep, biased by direction
  scatter(zones.deepCenter, 'triple', Math.round(counts.triple * centerFrac));
  scatter(zones.deepOppo,   'triple', Math.round(counts.triple * oppoFrac));
  scatter(zones.deepPull,   'triple', Math.round(counts.triple * pullFrac));

  // HRs: driven entirely by the player's real directional tendencies
  scatter(zones.hrPull,   'hr', Math.round(counts.hr * pullFrac));
  scatter(zones.hrCenter, 'hr', Math.round(counts.hr * centerFrac));
  scatter(zones.hrOppo,   'hr', Math.round(counts.hr * oppoFrac));

  return points;
}

// ─── Hot/Cold Heatmap (stat-informed) ────────────────────────────────

/**
 * Build a 5×5 zone heatmap seeded by real stats.
 *
 * Logic:
 * - Base value from wOBA
 * - High K% → cold on outer/low zones
 * - High BB% → hot in the middle (discipline = patient in zone)
 * - High ISO → hot on inner half (pull power)
 * - Pull tendency → boosted pull-side zones
 */
export function buildHeatmap(
  stats: HittingStats,
  bats: 'R' | 'L' | 'S',
  mlbId: number
): HeatmapZone[] {
  const rng = seeded(mlbId + Math.round((stats.woba || 0.33) * 1000));
  const woba    = stats.woba    || 0.33;
  const iso     = stats.iso     || 0.15;
  const kPct    = stats.kPct    || 22;
  const bbPct   = stats.bbPct   || 8;

  // Base zone matrix: row 0 = top of zone, col 0 = inside (pull side for RHB)
  // Slightly favour middle-middle and inside-middle
  const base = [
    [0.82, 0.88, 0.84, 0.76, 0.68],
    [0.86, 0.96, 0.98, 0.88, 0.74],
    [0.84, 0.98, 1.04, 0.94, 0.78],
    [0.76, 0.88, 0.90, 0.82, 0.68],
    [0.60, 0.72, 0.74, 0.66, 0.52],
  ];

  // Modifiers
  const kPenalty   = Math.max(0, (kPct - 20) / 100);   // chase/whiff → cold on edges
  const bbBoost    = Math.max(0, (bbPct - 8)  / 100);  // discipline → hot in zone
  const isoPower   = Math.max(0, (iso - 0.15) / 0.30); // power → hot on pull side

  const zones: HeatmapZone[] = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      let v = base[row][col];

      // Edge zones → punished by high K%
      const isEdge = row === 0 || row === 4 || col === 0 || col === 4;
      if (isEdge) v -= kPenalty * 0.4;

      // Middle zones → boosted by BB% (discipline means they hit middle well)
      const isMiddle = row >= 1 && row <= 3 && col >= 1 && col <= 3;
      if (isMiddle) v += bbBoost * 0.3;

      // Pull-side boost (col 0-1 for RHB, col 3-4 for LHB)
      const isPull = bats === 'L' ? col >= 3 : col <= 1;
      if (isPull) v += isoPower * 0.25;

      // Scale to actual wOBA range
      const rawZoneWoba = woba * v;
      // Add small deterministic noise
      const noise = (rng() - 0.5) * 0.018;
      const final = Math.max(0.12, Math.min(0.70, rawZoneWoba + noise));

      // Offset by 2 so indices match the mock 9×9 grid lookup in HittingPage
      // (which does: heatmap.find(z => z.row === row + 2 && z.col === col + 2))
      zones.push({ row: row + 2, col: col + 2, value: Math.round(final * 1000) / 1000 });
    }
  }

  return zones;
}
