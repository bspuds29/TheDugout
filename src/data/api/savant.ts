/**
 * Baseball Savant / Statcast client
 *
 * Uses the /leaderboard/custom CSV endpoint which has open CORS (no proxy needed,
 * no Cloudflare block). The leaderboard is fetched once per year per session
 * and cached in memory — individual player lookups just filter the cached data.
 *
 * Confirmed working fields (2025-04-18):
 *   exit_velocity_avg, launch_angle_avg, barrel_batted_rate,
 *   hard_hit_percent, sweet_spot_percent, xba, xslg, xwoba,
 *   xwobacon, sprint_speed, whiff_percent, k_percent, bb_percent, pa
 */

const SAVANT_BASE = 'https://baseballsavant.mlb.com';

// ─── Stat shapes ──────────────────────────────────────────────────────

export interface SavantBatterStats {
  mlbId:        number;
  name:         string;
  year:         number;
  pa:           number;
  exitVelo:     number;
  launchAngle:  number;
  barrelPct:    number;
  hardHitPct:   number;
  sweetSpotPct: number;
  xwoba:        number;
  xba:          number;
  sprintSpeed:  number;
  whiffPct:     number;
  chasePct:     number;
  contactPct:   number;
  woba:         number;
  // Batted-ball profile
  gbPct:        number;
  fbPct:        number;
  ldPct:        number;
  pullPct:      number;
  straightPct:  number;
  oppoPct:      number;
}

export interface SavantPitcherStats {
  mlbId:             number;
  name:              string;
  year:              number;
  exitVeloAllowed:   number;
  barrelPctAllowed:  number;
  hardHitPctAllowed: number;
  xwoba:             number;
  xera:              number;
  fastballVelo:      number;
  fastballSpin:      number;
  whiffPct: number;
  chasePct: number;
  gbPct:             number;
  ldPct:             number;
  fbPct:             number;
}

// ─── CSV selections ───────────────────────────────────────────────────

const BATTER_COLS = [
  'pa',
  'exit_velocity_avg', 'launch_angle_avg',
  'barrel_batted_rate', 'hard_hit_percent', 'sweet_spot_percent',
  'xba', 'xslg', 'xwoba', 'xwobacon',
  'sprint_speed', 'whiff_percent', 'chase_percent',
  'k_percent', 'bb_percent',
  // Batted-ball profile (gb_percent etc. are accepted but return empty — use full names)
  'groundballs_percent', 'flyballs_percent', 'linedrives_percent',
  'pull_percent', 'straightaway_percent', 'opposite_percent',
].join(',');

const PITCHER_COLS = [
  'pa',
  'exit_velocity_avg', 'launch_angle_avg',
  'barrel_batted_rate', 'hard_hit_percent',
  'xwoba', 'xera',
  'fastball_avg_speed', 'fastball_avg_spin',
  'whiff_percent', 'chase_percent', 'o_swing_percent', 'oz_swing_percent',
  'groundballs_percent', 'flyballs_percent', 'linedrives_percent',
].join(',');

// ─── Module-level leaderboard cache (one fetch per year/type) ─────────

const _cache = new Map<string, Promise<Record<string, string>[]>>();

function cacheKey(year: number, type: string) {
  return `${type}-${year}`;
}

// ─── CSV helpers ──────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
}

function num(v: string | number | undefined | null, fallback = 0): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? fallback : n;
}

// ─── Core leaderboard fetch ───────────────────────────────────────────

function getLeaderboard(
  year: number,
  type: 'batter' | 'pitcher'
): Promise<Record<string, string>[]> {
  const key = cacheKey(year, type);
  if (!_cache.has(key)) {
    const selections = type === 'batter' ? BATTER_COLS : PITCHER_COLS;
    const url =
      `${SAVANT_BASE}/leaderboard/custom` +
      `?year=${year}&type=${type}&filter=&min=1` +
      `&selections=${selections}` +
      `&chart=false&x=xba&y=xba&r=no&chartType=beeswarm&csv=false`;

    const promise = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`Savant leaderboard ${r.status}`);
        return r.text();
      })
      .then(text => {
        const rows = parseCSV(text);
        console.info(`[Savant] Leaderboard loaded: ${rows.length} ${type}s for ${year}`);
        return rows;
      })
      .catch(e => {
        _cache.delete(key); // retry next time
        console.warn(`[Savant] Leaderboard fetch failed (${type} ${year}):`, e);
        throw e;
      });

    _cache.set(key, promise);
  }
  return _cache.get(key)!;
}

// ─── Public API ───────────────────────────────────────────────────────

export async function fetchSavantBatterById(
  mlbId: number,
  year: number
): Promise<SavantBatterStats | null> {
  try {
    const rows = await getLeaderboard(year, 'batter');
    const r = rows.find(row => row['player_id'] === String(mlbId));
    if (!r) return null;

    const name = [r['first_name'], r['last_name']].filter(Boolean).join(' ')
      || r['player_name']
      || r['last_name, first_name']
      || '';

    return {
      mlbId,
      name,
      year,
      pa:           num(r['pa']),
      exitVelo:     num(r['exit_velocity_avg']),
      launchAngle:  num(r['launch_angle_avg']),
      barrelPct:    num(r['barrel_batted_rate']),
      hardHitPct:   num(r['hard_hit_percent']),
      sweetSpotPct: num(r['sweet_spot_percent']),
      xwoba:        num(r['xwoba']),
      xba:          num(r['xba']),
      sprintSpeed:  num(r['sprint_speed']),
      whiffPct:     num(r['whiff_percent']),
      chasePct:     num(r['chase_percent']),
      contactPct:   0,
      woba:         num(r['woba'] ?? r['xwoba']),
      gbPct:        num(r['groundballs_percent']),
      fbPct:        num(r['flyballs_percent']),
      ldPct:        num(r['linedrives_percent']),
      pullPct:      num(r['pull_percent']),
      straightPct:  num(r['straightaway_percent']),
      oppoPct:      num(r['opposite_percent']),
    };
  } catch {
    return null;
  }
}

export async function fetchSavantPitcherById(
  mlbId: number,
  year: number
): Promise<SavantPitcherStats | null> {
  try {
    const rows = await getLeaderboard(year, 'pitcher');
    const r = rows.find(row => row['player_id'] === String(mlbId));
    if (!r) return null;

    // Debug: log all column keys so we can identify the correct chase-rate field name
    console.info('[Savant Pitcher] columns:', Object.keys(r));
    console.info('[Savant Pitcher] raw row:', r);

    const name = [r['first_name'], r['last_name']].filter(Boolean).join(' ')
      || r['player_name']
      || '';

    return {
      mlbId,
      name,
      year,
      exitVeloAllowed:   num(r['exit_velocity_avg']),
      barrelPctAllowed:  num(r['barrel_batted_rate']),
      hardHitPctAllowed: num(r['hard_hit_percent']),
      xwoba:             num(r['xwoba']),
      xera:              num(r['xera']),
      fastballVelo:      num(r['fastball_avg_speed']),
      fastballSpin:      num(r['fastball_avg_spin']),
      whiffPct: num(r['whiff_percent']),
      chasePct: num(r['chase_percent'] || r['o_swing_percent'] || r['oz_swing_percent']),
      gbPct:             num(r['groundballs_percent']),
      ldPct:             num(r['linedrives_percent']),
      fbPct:             num(r['flyballs_percent']),
    };
  } catch {
    return null;
  }
}

// ─── Statcast spray chart (real batted-ball coordinates) ─────────────
//
// Uses the statcast_search/csv endpoint with type=details to get
// individual event rows with hc_x / hc_y hit coordinates.
// Only hits (single/double/triple/home_run) are requested to minimise
// payload size.  Falls back to null on CORS / network error — the
// caller should then use the generated chart instead.
//
// Coordinate mapping (Savant → our 500×420 SVG):
//   svgX = hc_x * 2                              (0-250 → 0-500)
//   svgY = 21 + (hc_y - 25) * (359 / 178)        (CF≈25 → 21, HP≈203 → 380)

import type { SprayChartPoint } from '../types';

export async function fetchStatcastSprayChart(
  mlbId: number,
  season: number,
): Promise<SprayChartPoint[] | null> {
  try {
    const url =
      `${SAVANT_BASE}/statcast_search/csv` +
      `?hfSea=${season}%7C` +
      `&player_type=batter` +
      `&type=details` +
      `&player_id=${mlbId}` +
      `&hfAB=single%7Cdouble%7Ctriple%7Chome_run%7C` +
      `&hfGT=R%7C` +
      `&min_results=0` +
      `&group_by=name` +
      `&sort_col=pitches&sort_order=desc`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const text = await res.text();
    const rows = parseCSV(text.replace(/^﻿/, '')); // strip BOM if present
    if (!rows.length) return null;

    const points: SprayChartPoint[] = [];
    for (const r of rows) {
      const hcX = num(r['hc_x']);
      const hcY = num(r['hc_y']);
      // Skip rows with missing/zero coordinates
      if (!hcX || !hcY) continue;

      const events = (r['events'] ?? '').trim().toLowerCase();
      let type: SprayChartPoint['type'];
      if      (events === 'single')    type = 'single';
      else if (events === 'double')    type = 'double';
      else if (events === 'triple')    type = 'triple';
      else if (events === 'home_run')  type = 'hr';
      else continue;

      const svgX = Math.round(hcX * 2);
      const svgY = Math.round(21 + (hcY - 25) * (359 / 178));

      points.push({ x: svgX, y: svgY, type });
    }

    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
}

// ─── Real league percentile ranks (batter + pitcher) ─────────────────
//
// Reuses the already-cached /leaderboard/custom data — zero extra network
// calls.  For each stat we sort the full player pool, find the player's
// position in that sorted list, and express it as a 1-99 percentile.
//
// Minimum PA thresholds are applied client-side to keep the comparison
// pool meaningful (eliminate 1-game callups skewing the distribution).

export interface SavantBatterPercentiles {
  exitVelo:   number;  // 1-99 — higher = better
  barrelPct:  number;
  hardHitPct: number;
  bbPct:      number;
  kPct:       number;  // inverse: lower K% → higher rank
  xwoba:      number;
}

export interface SavantPitcherPercentiles {
  kPct:      number;
  bbPct:     number;  // inverse: lower BB% → higher rank
  gbPct:     number;
  xera:      number;  // inverse: lower xERA → higher rank
  velocity:  number;
  whiffPct:  number;
  chasePct:  number;
}

/** Sort pool by stat and return the player's percentile rank (1-99). */
function rankInLeague(
  pool: number[],
  playerVal: number,
  higherIsBetter: boolean,
): number {
  if (!pool.length || isNaN(playerVal)) return 50;
  const sorted = [...pool].sort((a, b) => a - b);
  if (higherIsBetter) {
    const below = sorted.filter(v => v < playerVal).length;
    return Math.max(1, Math.min(99, Math.round((below / sorted.length) * 100)));
  } else {
    const above = sorted.filter(v => v > playerVal).length;
    return Math.max(1, Math.min(99, Math.round((above / sorted.length) * 100)));
  }
}

export async function computeBatterSavantPercentiles(
  mlbId: number,
  year: number,
): Promise<SavantBatterPercentiles | null> {
  try {
    const rows = await getLeaderboard(year, 'batter');
    const player = rows.find(r => r['player_id'] === String(mlbId));
    if (!player) return null;

    // Only compare against players with meaningful sample (≥100 PA)
    const qualified = rows.filter(r => num(r['pa']) >= 100);
    if (qualified.length < 20) return null; // too early in season

    const col = (c: string) => qualified.map(r => num(r[c])).filter(v => v > 0);
    const pv  = (c: string) => num(player[c]);

    return {
      exitVelo:   rankInLeague(col('exit_velocity_avg'),    pv('exit_velocity_avg'),    true),
      barrelPct:  rankInLeague(col('barrel_batted_rate'),   pv('barrel_batted_rate'),   true),
      hardHitPct: rankInLeague(col('hard_hit_percent'),     pv('hard_hit_percent'),     true),
      bbPct:      rankInLeague(col('bb_percent'),           pv('bb_percent'),           true),
      kPct:       rankInLeague(col('k_percent'),            pv('k_percent'),            false),
      xwoba:      rankInLeague(col('xwoba'),                pv('xwoba'),                true),
    };
  } catch {
    return null;
  }
}

export async function computePitcherSavantPercentiles(
  mlbId: number,
  year: number,
): Promise<SavantPitcherPercentiles | null> {
  try {
    const rows = await getLeaderboard(year, 'pitcher');
    const player = rows.find(r => r['player_id'] === String(mlbId));
    if (!player) return null;

    // Filter to pitchers with meaningful samples — use whiff_percent as a
    // proxy for min innings since we don't have IP in the Savant leaderboard.
    const qualified = rows.filter(r => num(r['whiff_percent']) > 0 && num(r['xera']) > 0);
    if (qualified.length < 20) return null;

    const col = (c: string) => qualified.map(r => num(r[c])).filter(v => v > 0);
    const pv  = (c: string) => num(player[c]);

    return {
      kPct:      rankInLeague(col('k_percent'),            pv('k_percent'),            true),
      bbPct:     rankInLeague(col('bb_percent'),           pv('bb_percent'),            false),
      gbPct:     rankInLeague(col('groundballs_percent'),  pv('groundballs_percent'),   true),
      xera:      rankInLeague(col('xera'),                 pv('xera'),                  false),
      velocity:  rankInLeague(col('fastball_avg_speed'),   pv('fastball_avg_speed'),    true),
      whiffPct:  rankInLeague(col('whiff_percent'),        pv('whiff_percent'),         true),
      chasePct:  rankInLeague(col('chase_percent'),        pv('chase_percent'),         true),
    };
  } catch {
    return null;
  }
}

// ─── Statcast hot/cold zone data (real wOBA per strike zone) ─────────
//
// Fetches ALL plate appearances (no hfAB filter) to get terminal-pitch
// woba_value per zone (1-9 = 3×3 strike zone grid, reading order).
// Only rows where woba_value is non-empty are counted — this filters to
// terminal pitches only (BA/BB/K/HBP events).

export interface ZoneWoba {
  zone: number;   // 1-9 (Savant zone numbering, left-to-right, top-to-bottom)
  woba: number;   // average wOBA on pitches in this zone
  count: number;  // plate appearance count used in average
}

export async function fetchStatcastZoneData(
  mlbId: number,
  season: number,
): Promise<ZoneWoba[] | null> {
  try {
    const url =
      `${SAVANT_BASE}/statcast_search/csv` +
      `?hfSea=${season}%7C` +
      `&player_type=batter` +
      `&type=details` +
      `&player_id=${mlbId}` +
      `&hfGT=R%7C` +
      `&min_results=0` +
      `&group_by=name` +
      `&sort_col=pitches&sort_order=desc`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const text = await res.text();
    const rows = parseCSV(text.replace(/^﻿/, '')); // strip BOM
    if (!rows.length) return null;

    const zoneMap: Record<number, { sum: number; count: number }> = {};
    for (const row of rows) {
      const wobaStr = row['woba_value'];
      if (!wobaStr || wobaStr.trim() === '') continue; // only terminal pitches have woba_value
      const woba = parseFloat(wobaStr);
      if (isNaN(woba)) continue;
      const zone = Number(row['zone']);
      if (!zone || isNaN(zone) || zone < 1 || zone > 9) continue; // 1-9 = strike zone only
      if (!zoneMap[zone]) zoneMap[zone] = { sum: 0, count: 0 };
      zoneMap[zone].sum   += woba;
      zoneMap[zone].count += 1;
    }

    const result: ZoneWoba[] = Object.entries(zoneMap).map(([z, { sum, count }]) => ({
      zone:  Number(z),
      woba:  Math.round((sum / count) * 1000) / 1000,
      count,
    }));

    console.info(`[Savant] Zone data loaded: ${result.length} zones for batter ${mlbId} (${season})`);
    return result.length >= 3 ? result : null;
  } catch (e) {
    console.warn('[Savant] Zone data fetch failed:', e);
    return null;
  }
}

// Legacy leaderboard exports (unused — individual lookups now via above)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchSavantBatters(_season?: number, _minPA?: number): Promise<SavantBatterStats[]> { return []; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchSavantPitchers(_season?: number, _minPA?: number): Promise<SavantPitcherStats[]> { return []; }

// ─── Per-pitch-type spin rates ────────────────────────────────────────
//
// The /leaderboard/custom CSV endpoint carries separate avg spin columns for
// each pitch type.  We cache the full list once per season then filter by
// player_id.

/** Maps a Statcast pitch code to the matching Savant leaderboard column name */
const PITCH_CODE_TO_SPIN_COL: Record<string, string> = {
  FF: 'fastball_avg_spin',
  FA: 'fastball_avg_spin',
  FT: 'fastball_avg_spin',
  SI: 'si_avg_spin',
  FC: 'fc_avg_spin',
  SL: 'sl_avg_spin',
  ST: 'st_avg_spin',   // Sweeper
  CH: 'ch_avg_spin',
  CS: 'ch_avg_spin',   // Slow curve / circle change
  CU: 'cu_avg_spin',
  KC: 'cu_avg_spin',   // Knuckle-curve
  FS: 'fs_avg_spin',   // Splitter
  FO: 'fs_avg_spin',   // Forkball
  SV: 'sv_avg_spin',   // Slurve
  KN: 'kn_avg_spin',   // Knuckleball
};

const SPIN_SELECTIONS = [
  'fastball_avg_spin', 'si_avg_spin', 'fc_avg_spin',
  'sl_avg_spin', 'st_avg_spin', 'ch_avg_spin',
  'cu_avg_spin', 'fs_avg_spin', 'sv_avg_spin', 'kn_avg_spin',
].join(',');

const _spinCache = new Map<number, Promise<Record<string, string>[]>>();

function getSpinLeaderboard(year: number): Promise<Record<string, string>[]> {
  if (!_spinCache.has(year)) {
    const url =
      `${SAVANT_BASE}/leaderboard/custom` +
      `?year=${year}&type=pitcher&filter=&min=10` +
      `&selections=${SPIN_SELECTIONS}` +
      `&chart=false&x=xba&y=xba&r=no&chartType=beeswarm&csv=true`;

    const promise = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`Savant spin leaderboard ${r.status}`);
        return r.text();
      })
      .then(text => {
        const rows = parseCSV(text.replace(/^﻿/, '')); // strip BOM
        console.info(`[Savant] Spin leaderboard loaded: ${rows.length} pitchers for ${year}`);
        return rows;
      })
      .catch(e => {
        _spinCache.delete(year);
        console.warn('[Savant] Spin leaderboard fetch failed:', e);
        throw e;
      });

    _spinCache.set(year, promise);
  }
  return _spinCache.get(year)!;
}

/**
 * Returns a map of Statcast pitch code → average spin rate (rpm) for a
 * specific pitcher.  Empty map on any failure.
 *
 * Example: { FF: 2453, SL: 2314, CH: 1793, CU: 2517 }
 */
export async function fetchPitchSpinById(
  mlbId: number,
  year: number
): Promise<Record<string, number>> {
  try {
    const rows = await getSpinLeaderboard(year);
    const row  = rows.find(r => r['player_id'] === String(mlbId));
    if (!row) return {};

    const result: Record<string, number> = {};
    for (const [code, col] of Object.entries(PITCH_CODE_TO_SPIN_COL)) {
      const val = num(row[col]);
      if (val > 0) result[code] = Math.round(val);
    }
    return result;
  } catch {
    return {};
  }
}
