/**
 * FanGraphs public API client
 * Endpoint: /api/leaders/major-league/data
 * Returns JSON — no auth required.
 *
 * Used for:
 *  - Pitcher discipline stats (O-Swing% / Chase Rate) — type=5, stats=pit
 *  - Fielding stats (OAA, DRS, UZR, UZR/150, Defense) — type=1, stats=fld
 *
 * Player matching: FanGraphs stores the MLB Stats API player ID as `xMLBAMID`.
 * O-Swing% is returned as a decimal (0.264 = 26.4%) — multiply by 100.
 *
 * CORS note: FanGraphs does not set permissive CORS headers, so requests from
 * a browser (production) may be blocked.  All public functions return empty
 * arrays / null on failure.  Use `getFanGraphsStatus()` to surface a subtle
 * "FanGraphs data unavailable" notice in the UI rather than silent zeros.
 */

const FG_BASE = 'https://www.fangraphs.com';

// ─── Module-level cache (one fetch per season per type) ───────────────

const _cache = new Map<string, Promise<Record<string, unknown>[]>>();

// ─── CORS / availability tracking ────────────────────────────────────

/** Whether at least one FanGraphs request has succeeded this session */
let _fgReachable: boolean | null = null;  // null = untested

/**
 * Returns the current FanGraphs reachability state:
 *  - `'ok'`      — at least one request succeeded
 *  - `'blocked'` — all attempts have failed (likely CORS in production)
 *  - `'unknown'` — no request has been made yet
 */
export function getFanGraphsStatus(): 'ok' | 'blocked' | 'unknown' {
  if (_fgReachable === true)  return 'ok';
  if (_fgReachable === false) return 'blocked';
  return 'unknown';
}

/** Detect CORS-style failures: fetch() throws a TypeError with no HTTP status */
function isCorsError(e: unknown): boolean {
  return e instanceof TypeError;
}

function markReachable()   { _fgReachable = true;  }
function markUnreachable() { if (_fgReachable !== true) _fgReachable = false; }

async function getPitcherLeaderboard(year: number): Promise<Record<string, unknown>[]> {
  const key = `fg-pit-${year}`;
  if (!_cache.has(key)) {
    // type=5 = Advanced/Discipline stats (includes O-Swing%, Z-Swing%, SwStr%, etc.)
    const url =
      `${FG_BASE}/api/leaders/major-league/data` +
      `?pos=all&stats=pit&lg=all&qual=0` +
      `&season=${year}&season1=${year}` +
      `&startdate=&enddate=&month=0&hand=&team=0` +
      `&pageitems=100000&pagenum=1&ind=0&rost=0&players=0` +
      `&type=5&postseason=&sortdir=default&sortstat=WAR`;

    const promise = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`FanGraphs ${r.status}`);
        return r.json() as Promise<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>;
      })
      .then(json => {
        // FanGraphs wraps rows in { data: [...] }
        const rows = (json as { data?: Record<string, unknown>[] }).data ?? (json as Record<string, unknown>[]);
        markReachable();
        console.info(`[FanGraphs] Pitcher leaderboard: ${rows.length} rows for ${year}`);
        return rows;
      })
      .catch(e => {
        _cache.delete(key);
        if (isCorsError(e)) markUnreachable();
        console.warn('[FanGraphs] Pitcher fetch failed (CORS or network):', e);
        throw e;
      });

    _cache.set(key, promise);
  }
  return _cache.get(key)!;
}

function pct(v: unknown): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return 0;
  // FanGraphs returns fractions (0.264) — convert to percent
  return n < 1.5 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

export interface FanGraphsPitcherStats {
  mlbId:      number;
  year:       number;
  oSwingPct:  number;   // Chase rate (O-Swing%)
  zSwingPct:  number;   // In-zone swing rate
  swStrPct:   number;   // Swinging strike rate
  fStrikePct: number;   // First-pitch strike rate
}

// ─── Fielding leaderboard ────────────────────────────────────────────

async function fetchFldRows(year: number): Promise<Record<string, unknown>[]> {
  const url =
    `${FG_BASE}/api/leaders/major-league/data` +
    `?pos=all&stats=fld&lg=all&qual=0` +
    `&season=${year}&season1=${year}` +
    `&startdate=&enddate=&month=0&hand=&team=0` +
    `&pageitems=100000&pagenum=1&ind=0&rost=0&players=0` +
    `&type=1&postseason=&sortdir=default&sortstat=DEF`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`FanGraphs fielding ${year} ${r.status}`);
    const json = await r.json() as { data?: Record<string, unknown>[] } | Record<string, unknown>[];
    markReachable();
    return (json as { data?: Record<string, unknown>[] }).data ?? (json as Record<string, unknown>[]);
  } catch (e) {
    if (isCorsError(e)) markUnreachable();
    console.warn(`[FanGraphs] Fielding fetch failed for ${year}:`, e);
    throw e;
  }
}

function hasUzrData(rows: Record<string, unknown>[]): boolean {
  return rows.some(r => r['UZR'] !== null && r['UZR'] !== undefined && r['UZR'] !== '');
}

async function getFieldingLeaderboard(year: number): Promise<Record<string, unknown>[]> {
  const key = `fg-fld-${year}`;
  if (!_cache.has(key)) {
    const promise = (async () => {
      const rows = await fetchFldRows(year);
      console.info(`[FanGraphs] Fielding leaderboard: ${rows.length} rows for ${year}`);

      // UZR is a slow-updating metric — often null early in the season.
      // When that happens, fill in UZR/UZR/150 from the previous year as a proxy.
      if (!hasUzrData(rows) && year > 2022) {
        try {
          const prev = await fetchFldRows(year - 1);
          if (hasUzrData(prev)) {
            const prevMap = new Map<number, Record<string, unknown>>();
            prev.forEach(r => {
              const id = Number(r['xMLBAMID'] ?? r['MLBAMID']);
              if (id > 0) prevMap.set(id, r);
            });
            console.info(`[FanGraphs] UZR null for ${year} — using ${year - 1} UZR as reference`);
            return rows.map(r => {
              const id = Number(r['xMLBAMID'] ?? r['MLBAMID']);
              const p  = prevMap.get(id);
              if (!p) return r;
              return {
                ...r,
                'UZR':     p['UZR'],
                'UZR/150': p['UZR/150'],
                'RngR':    p['RngR'],
                'ErrR':    p['ErrR'],
                'ARM':     p['ARM'],
              };
            });
          }
        } catch {
          // prev year unavailable — fall through
        }
      }

      return rows;
    })();

    promise.catch(() => _cache.delete(key));
    _cache.set(key, promise);
  }
  return _cache.get(key)!;
}

/**
 * Calculate UZR/150 from raw UZR + innings when the field isn't directly
 * available from the API.  Formula: (UZR / Inn) * 1350  (150 games × 9 inn).
 */
function calcUzr150(uzr: number | null, inn: number): number | null {
  if (uzr === null || inn < 10) return null;
  return Math.round((uzr / inn) * 1350 * 10) / 10;
}

function maybeNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : Math.round(n * 10) / 10;
}

export interface FanGraphsFieldingStats {
  mlbId:      number;
  year:       number;
  name:       string;
  pos:        string;
  games:      number;
  innings:    number;
  fieldingPct: number;
  putouts:    number;
  assists:    number;
  errors:     number;
  doublePlays: number;
  oaa:        number | null;
  drs:        number | null;
  uzr:        number | null;
  uzr150:     number | null;
  defense:    number | null;   // FanGraphs composite Defense metric
  rngR:       number | null;
  errR:       number | null;
  armR:       number | null;
  cFraming:   number | null;   // catchers only
  rSB:        number | null;   // catchers only (arm / caught stealing runs)
}

export async function fetchFanGraphsFieldingLeaderboard(year: number): Promise<FanGraphsFieldingStats[]> {
  try {
    const rows = await getFieldingLeaderboard(year);
    return rows
      .filter(r => Number(r['xMLBAMID']) > 0)
      .map(r => {
        const uzr = maybeNum(r['UZR']);
        const inn = Number(r['Inn'] ?? 0);
        return {
          mlbId:       Number(r['xMLBAMID']),
          year,
          name:        String(r['PlayerName'] ?? ''),
          pos:         String(r['Pos'] ?? r['Position'] ?? ''),
          games:       Number(r['G'] ?? 0),
          innings:     Math.round(inn),
          fieldingPct: Number(r['FP'] ?? 0),
          putouts:     Number(r['PO'] ?? 0),
          assists:     Number(r['A']  ?? 0),
          errors:      Number(r['E']  ?? 0),
          doublePlays: Number(r['DP'] ?? 0),
          oaa:         maybeNum(r['OAA']),
          drs:         maybeNum(r['DRS']),
          uzr,
          uzr150:      maybeNum(r['UZR/150']) ?? calcUzr150(uzr, inn),
          defense:     maybeNum(r['Defense']),
          rngR:        maybeNum(r['RngR']),
          errR:        maybeNum(r['ErrR']),
          armR:        maybeNum(r['ARM']),
          cFraming:    maybeNum(r['CFraming']),
          rSB:         maybeNum(r['rSB']),
        };
      });
  } catch {
    return [];
  }
}

export async function fetchFanGraphsFieldingById(
  mlbId: number,
  year: number
): Promise<FanGraphsFieldingStats | null> {
  try {
    const rows = await getFieldingLeaderboard(year);
    const r = rows.find(row =>
      Number(row['xMLBAMID']) === mlbId ||
      Number(row['MLBAMID'])  === mlbId
    );
    if (!r) {
      return null;
    }
    console.info(`[FanGraphs] Fielding ${mlbId} loaded from ${year}`);
    return buildFieldingStats(mlbId, year, r);
  } catch {
    return null;
  }
}

function buildFieldingStats(mlbId: number, year: number, r: Record<string, unknown>): FanGraphsFieldingStats {
  const uzr = maybeNum(r['UZR']);
  const inn = Number(r['Inn'] ?? 0);
  return {
    mlbId,
    year,
    name:        String(r['PlayerName'] ?? ''),
    pos:         String(r['Pos'] ?? r['Position'] ?? ''),
    games:       Number(r['G'] ?? 0),
    innings:     Math.round(inn),
    fieldingPct: Number(r['FP'] ?? 0),
    putouts:     Number(r['PO'] ?? 0),
    assists:     Number(r['A']  ?? 0),
    errors:      Number(r['E']  ?? 0),
    doublePlays: Number(r['DP'] ?? 0),
    oaa:         maybeNum(r['OAA']),
    drs:         maybeNum(r['DRS']),
    uzr,
    uzr150:      maybeNum(r['UZR/150']) ?? calcUzr150(uzr, inn),
    defense:     maybeNum(r['Defense']),
    rngR:        maybeNum(r['RngR']),
    errR:        maybeNum(r['ErrR']),
    armR:        maybeNum(r['ARM']),
    cFraming:    maybeNum(r['CFraming']),
    rSB:         maybeNum(r['rSB']),
  };
}

// ─── Batting leaderboard ─────────────────────────────────────────────

async function getBattingLeaderboard(year: number): Promise<Record<string, unknown>[]> {
  const key = `fg-bat-${year}`;
  if (!_cache.has(key)) {
    const url =
      `${FG_BASE}/api/leaders/major-league/data` +
      `?pos=all&stats=bat&lg=all&qual=0` +
      `&season=${year}&season1=${year}` +
      `&startdate=&enddate=&month=0&hand=&team=0` +
      `&pageitems=100000&pagenum=1&ind=0&rost=0&players=0` +
      `&type=8&postseason=&sortdir=default&sortstat=WAR`;

    const promise = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`FanGraphs batting ${r.status}`);
        return r.json() as Promise<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>;
      })
      .then(json => {
        const rows = (json as { data?: Record<string, unknown>[] }).data ?? (json as Record<string, unknown>[]);
        markReachable();
        console.info(`[FanGraphs] Batting leaderboard: ${rows.length} rows for ${year}`);
        return rows;
      })
      .catch(e => {
        _cache.delete(key);
        if (isCorsError(e)) markUnreachable();
        console.warn('[FanGraphs] Batting fetch failed:', e);
        throw e;
      });

    _cache.set(key, promise);
  }
  return _cache.get(key)!;
}

async function getPitchingLeaderboard8(year: number): Promise<Record<string, unknown>[]> {
  const key = `fg-pit8-${year}`;
  if (!_cache.has(key)) {
    const url =
      `${FG_BASE}/api/leaders/major-league/data` +
      `?pos=all&stats=pit&lg=all&qual=0` +
      `&season=${year}&season1=${year}` +
      `&startdate=&enddate=&month=0&hand=&team=0` +
      `&pageitems=100000&pagenum=1&ind=0&rost=0&players=0` +
      `&type=8&postseason=&sortdir=default&sortstat=WAR`;

    const promise = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`FanGraphs pitching ${r.status}`);
        return r.json() as Promise<{ data?: Record<string, unknown>[] } | Record<string, unknown>[]>;
      })
      .then(json => {
        const rows = (json as { data?: Record<string, unknown>[] }).data ?? (json as Record<string, unknown>[]);
        markReachable();
        console.info(`[FanGraphs] Pitching leaderboard: ${rows.length} rows for ${year}`);
        return rows;
      })
      .catch(e => {
        _cache.delete(key);
        if (isCorsError(e)) markUnreachable();
        console.warn('[FanGraphs] Pitching fetch failed:', e);
        throw e;
      });

    _cache.set(key, promise);
  }
  return _cache.get(key)!;
}

function asPct(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return 0;
  // FanGraphs returns fractions for most rate stats (0.35 = 35%)
  return n < 1.5 ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
}

function asNum(v: unknown, decimals = 3): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (isNaN(n)) return 0;
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export interface FanGraphsBatterRow {
  mlbId:    number;
  name:     string;
  team:     string;
  pos:      string;
  g:        number;
  pa:       number;
  hr:       number;
  r:        number;
  rbi:      number;
  sb:       number;
  avg:      number;
  obp:      number;
  slg:      number;
  ops:      number;
  iso:      number;
  babip:    number;
  woba:     number;
  xwoba:    number;
  wrcPlus:  number;
  bbPct:    number;   // percent
  kPct:     number;
  hardPct:  number;
  barrelPct:number;
  exitVelo: number;
  gbPct:    number;
  ldPct:    number;
  fbPct:    number;
  war:      number;
  wpa:      number;
  re24:     number;
  clutch:   number;
}

export interface FanGraphsPitcherRow {
  mlbId:     number;
  name:      string;
  team:      string;
  pos:       string;   // 'SP' | 'RP' | 'P'
  g:         number;
  gs:        number;
  ip:        number;
  w:         number;
  l:         number;
  sv:        number;
  era:       number;
  fip:       number;
  xfip:      number;
  xera:      number;
  whip:      number;
  kPct:      number;
  bbPct:     number;
  kBBPct:    number;
  k9:        number;
  bb9:       number;
  hr9:       number;
  babip:     number;
  lobPct:    number;
  gbPct:     number;
  fbPct:     number;
  swStrPct:  number;
  oSwingPct: number;
  war:       number;
  wpa:       number;
  re24:      number;
}

/** Returns true for multi-team aggregate rows like "2TM", "3TM", "- - -" */
function isMultiTeamRow(r: Record<string, unknown>): boolean {
  const t = String(r['TeamNameAbb'] ?? r['TeamName'] ?? '').trim();
  return /^\d/.test(t) || /^-+/.test(t) || t === '';
}

export async function fetchFanGraphsBattingLeaderboard(year: number): Promise<FanGraphsBatterRow[]> {
  try {
    const rows = await getBattingLeaderboard(year);
    return rows
      .filter(r => Number(r['xMLBAMID']) > 0 && !isMultiTeamRow(r))
      .map(r => ({
        mlbId:     Number(r['xMLBAMID']),
        name:      String(r['PlayerName'] ?? ''),
        team:      String(r['TeamNameAbb'] ?? r['TeamName'] ?? ''),
        pos:       String(r['positionDB'] ?? r['position'] ?? r['Pos'] ?? ''),
        g:         Number(r['G']   ?? 0),
        pa:        Number(r['PA']  ?? 0),
        hr:        Number(r['HR']  ?? 0),
        r:         Number(r['R']   ?? 0),
        rbi:       Number(r['RBI'] ?? 0),
        sb:        Number(r['SB']  ?? 0),
        avg:       asNum(r['AVG'],  3),
        obp:       asNum(r['OBP'],  3),
        slg:       asNum(r['SLG'],  3),
        ops:       asNum(r['OPS'],  3),
        iso:       asNum(r['ISO'],  3),
        babip:     asNum(r['BABIP'],3),
        woba:      asNum(r['wOBA'], 3),
        xwoba:     asNum(r['xwOBA'],3),
        wrcPlus:   Math.round(Number(r['wRC+'] ?? 0)),
        bbPct:     asPct(r['BB%']),
        kPct:      asPct(r['K%']),
        hardPct:   asPct(r['Hard%']),
        barrelPct: asPct(r['Barrel%']),
        exitVelo:  asNum(r['EV'], 1),
        gbPct:     asPct(r['GB%']),
        ldPct:     asPct(r['LD%']),
        fbPct:     asPct(r['FB%']),
        war:       asNum(r['WAR'], 1),
        wpa:       asNum(r['WPA'], 2),
        re24:      asNum(r['RE24'],1),
        clutch:    asNum(r['Clutch'],2),
      }));
  } catch {
    return [];
  }
}

export async function fetchFanGraphsPitchingLeaderboard(year: number): Promise<FanGraphsPitcherRow[]> {
  try {
    const rows = await getPitchingLeaderboard8(year);
    return rows
      .filter(r => Number(r['xMLBAMID']) > 0 && !isMultiTeamRow(r))
      .map(r => {
        const gs = Number(r['GS'] ?? 0);
        const g  = Number(r['G']  ?? 0);
        return {
          mlbId:     Number(r['xMLBAMID']),
          name:      String(r['PlayerName'] ?? ''),
          team:      String(r['TeamNameAbb'] ?? r['TeamName'] ?? ''),
          pos:       gs / Math.max(g, 1) >= 0.5 ? 'SP' : 'RP',
          g,
          gs,
          ip:        asNum(r['IP'], 1),
          w:         Number(r['W']  ?? 0),
          l:         Number(r['L']  ?? 0),
          sv:        Number(r['SV'] ?? 0),
          era:       asNum(r['ERA'],  2),
          fip:       asNum(r['FIP'],  2),
          xfip:      asNum(r['xFIP'], 2),
          xera:      asNum(r['xERA'], 2),
          whip:      asNum(r['WHIP'], 2),
          kPct:      asPct(r['K%']),
          bbPct:     asPct(r['BB%']),
          kBBPct:    asPct(r['K-BB%']),
          k9:        asNum(r['K/9'],  1),
          bb9:       asNum(r['BB/9'], 1),
          hr9:       asNum(r['HR/9'], 2),
          babip:     asNum(r['BABIP'],3),
          lobPct:    asPct(r['LOB%']),
          gbPct:     asPct(r['GB%']),
          fbPct:     asPct(r['FB%']),
          swStrPct:  asPct(r['SwStr%']),
          oSwingPct: asPct(r['O-Swing%']),
          war:       asNum(r['WAR'], 1),
          wpa:       asNum(r['WPA'], 2),
          re24:      asNum(r['RE24'],1),
        };
      });
  } catch {
    return [];
  }
}

// ─── Real league percentile helpers ──────────────────────────────────

function rankInLeague(pool: number[], playerVal: number, higherIsBetter: boolean): number {
  if (!pool.length || isNaN(playerVal) || playerVal === 0) return 50;
  const sorted = [...pool].sort((a, b) => a - b);
  if (higherIsBetter) {
    const below = sorted.filter(v => v < playerVal).length;
    return Math.max(1, Math.min(99, Math.round((below / sorted.length) * 100)));
  } else {
    const above = sorted.filter(v => v > playerVal).length;
    return Math.max(1, Math.min(99, Math.round((above / sorted.length) * 100)));
  }
}

/**
 * Returns the wRC+ percentile rank for a batter vs. all qualified hitters.
 * Reuses the already-cached batting leaderboard — no extra network call.
 */
export async function computeWrcPlusPercentile(
  mlbId: number,
  year: number,
): Promise<number | null> {
  try {
    const rows = await getBattingLeaderboard(year);
    const player = rows.find(r =>
      Number(r['xMLBAMID']) === mlbId || Number(r['MLBAMID']) === mlbId,
    );
    if (!player) return null;
    const playerWrc = Number(player['wRC+'] ?? 0);
    if (!playerWrc) return null;

    const pool = rows
      .filter(r => Number(r['PA'] ?? 0) >= 100)
      .map(r => Number(r['wRC+'] ?? 0))
      .filter(v => v > 0);

    return pool.length >= 20 ? rankInLeague(pool, playerWrc, true) : null;
  } catch {
    return null;
  }
}

/**
 * Returns the ERA percentile rank for a pitcher vs. all qualified pitchers.
 * Reuses the already-cached FanGraphs pitching leaderboard.
 */
export async function computeERAPercentile(
  mlbId: number,
  year: number,
): Promise<number | null> {
  try {
    const rows = await getPitchingLeaderboard8(year);
    const player = rows.find(r =>
      Number(r['xMLBAMID']) === mlbId || Number(r['MLBAMID']) === mlbId,
    );
    if (!player) return null;
    const playerEra = Number(player['ERA'] ?? 0);
    if (!playerEra) return null;

    const pool = rows
      .filter(r => Number(r['IP'] ?? 0) >= 20)
      .map(r => Number(r['ERA'] ?? 0))
      .filter(v => v > 0);

    return pool.length >= 20 ? rankInLeague(pool, playerEra, false) : null;
  } catch {
    return null;
  }
}

// ─── Pitcher discipline ───────────────────────────────────────────────

export async function fetchFanGraphsPitcherById(
  mlbId: number,
  year: number
): Promise<FanGraphsPitcherStats | null> {
  try {
    const rows = await getPitcherLeaderboard(year);
    const r = rows.find(row =>
      Number(row['xMLBAMID']) === mlbId ||
      Number(row['MLBAMID'])  === mlbId
    );
    if (!r) {
      // Try previous season as fallback
      if (year > 2021) {
        const prev = await getPitcherLeaderboard(year - 1);
        const rPrev = prev.find(row =>
          Number(row['xMLBAMID']) === mlbId ||
          Number(row['MLBAMID'])  === mlbId
        );
        if (rPrev) {
          console.info(`[FanGraphs] Pitcher ${mlbId} loaded from ${year - 1}`);
          return {
            mlbId,
            year: year - 1,
            oSwingPct:  pct(rPrev['O-Swing%']),
            zSwingPct:  pct(rPrev['Z-Swing%']),
            swStrPct:   pct(rPrev['SwStr%']),
            fStrikePct: pct(rPrev['F-Strike%']),
          };
        }
      }
      return null;
    }
    console.info(`[FanGraphs] Pitcher ${mlbId} loaded from ${year}`);
    return {
      mlbId,
      year,
      oSwingPct:  pct(r['O-Swing%']),
      zSwingPct:  pct(r['Z-Swing%']),
      swStrPct:   pct(r['SwStr%']),
      fStrikePct: pct(r['F-Strike%']),
    };
  } catch {
    return null;
  }
}

// ─── Per-player batter value stats ───────────────────────────────────

export interface FanGraphsBatterValue {
  wpa:    number;
  re24:   number;
  clutch: number;
  war:    number;
}

/**
 * Looks up WPA / RE24 / Clutch / WAR for a single batter from the
 * already-cached batting leaderboard (no extra network request after first load).
 */
export async function fetchFanGraphsBatterById(
  mlbId: number,
  year: number,
): Promise<FanGraphsBatterValue | null> {
  try {
    const rows = await getBattingLeaderboard(year);
    const r = rows.find(row =>
      Number(row['xMLBAMID']) === mlbId ||
      Number(row['MLBAMID'])  === mlbId,
    );
    if (!r) {
      // Try previous season as fallback
      if (year > 2021) {
        const prev = await getBattingLeaderboard(year - 1);
        const rp = prev.find(row =>
          Number(row['xMLBAMID']) === mlbId ||
          Number(row['MLBAMID'])  === mlbId,
        );
        if (rp) return {
          wpa:    asNum(rp['WPA'],    2),
          re24:   asNum(rp['RE24'],   1),
          clutch: asNum(rp['Clutch'], 2),
          war:    asNum(rp['WAR'],    1),
        };
      }
      return null;
    }
    return {
      wpa:    asNum(r['WPA'],    2),
      re24:   asNum(r['RE24'],   1),
      clutch: asNum(r['Clutch'], 2),
      war:    asNum(r['WAR'],    1),
    };
  } catch {
    return null;
  }
}
