/**
 * MLB Stats API client
 * Base URL: https://statsapi.mlb.com/api/v1
 * Free, no auth required, no CORS restrictions.
 * Docs: https://github.com/toddrob99/MLB-StatsAPI/wiki/Endpoints
 */

const BASE = 'https://statsapi.mlb.com/api/v1';

// ─── Raw API response shapes ──────────────────────────────────────────

export interface RawMLBTeam {
  id: number;
  name: string;
  teamName: string;
  abbreviation: string;
  teamCode: string;
  locationName: string;
  league: { id: number; name: string };
  division: { id: number; name: string };
  record?: { wins: number; losses: number; pct: string };
  venue?: { id: number; name: string };
}

export interface RawMLBPerson {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  nickName?: string;
  birthDate: string;
  birthCity?: string;
  birthStateProvince?: string;
  birthCountry?: string;
  currentAge: number;
  height: string;
  weight: number;
  primaryNumber: string;
  batSide: { code: string; description: string };
  pitchHand: { code: string; description: string };
  primaryPosition: { abbreviation: string; name: string; type: string };
  currentTeam?: { id: number; name: string; abbreviation: string };
  mlbDebutDate?: string;
  nameFirstLast?: string;
  strikeZoneTop?: number;
  strikeZoneBottom?: number;
  rosterEntries?: Array<{
    isActive: boolean;
    status: { code: string; description: string };
  }>;
}

export interface RawMLBPitchingStat {
  gamesPlayed: number;
  gamesStarted: number;
  wins: number;
  losses: number;
  saves: number;
  inningsPitched: string; // "180.1" format
  era: string;
  whip: string;
  strikeOuts: number;
  baseOnBalls: number;
  hits: number;
  homeRuns: number;
  earnedRuns: number;
  battersFaced: number;
  numberOfPitches: number;
  strikes: number;
  strikePercentage: string;
  groundOutsToAirouts: string;
  stolenBases: number;
  caughtStealing: number;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  atBats: number;
  sacBunts: number;
  sacFlies: number;
  doubles: number;
  triples: number;
  runsScoredPer9: string;
  homeRunsPer9: string;
  hitsPer9: string;
  strikeoutsPer9: string;
  walksPer9: string;
  strikeoutWalkRatio: string;
  pitchesPerInning: string;
}

export interface RawMLBHittingStat {
  gamesPlayed: number;
  plateAppearances: number;
  atBats: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  runs: number;
  baseOnBalls: number;
  strikeOuts: number;
  stolenBases: number;
  caughtStealing: number;
  avg: string;
  obp: string;
  slg: string;
  ops: string;
  babip: string;
  groundOuts: number;
  airOuts: number;
  leftOnBase: number;
  groundOutsToAirouts: string;
  sacBunts: number;
  sacFlies: number;
  intentionalWalks: number;
  hitByPitch: number;
  numberOfPitches: number;
  strikes: number;
  totalBases: number;
}

export interface RawMLBStatsResponse {
  stats: Array<{
    group: { displayName: string };
    type: { displayName: string };
    splits: Array<{
      season: string;
      stat: RawMLBPitchingStat | RawMLBHittingStat | RawMLBSabermetricsstat;
    }>;
  }>;
}

// ─── Career (year-by-year) types ──────────────────────────────────────

export interface CareerHittingSeason {
  season: string;
  teamAbbr: string;
  teamName: string;
  g: number;
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  r: number;
  sb: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  bb: number;
  k: number;
  war: number;
}

export interface CareerPitchingSeason {
  season: string;
  teamAbbr: string;
  teamName: string;
  g: number;
  gs: number;
  w: number;
  l: number;
  sv: number;
  ip: number;
  era: number;
  whip: number;
  k9: number;
  bb9: number;
  k: number;
  bb: number;
  hr: number;
  war: number;
}

export interface RawMLBSabermetricsstat {
  wOBA: number;
  wRCPlus: number;
  war: number;
  rar: number;
  spd: number;
  ubr: number;
  wBsR: number;
  fip: number;
}

export interface RawMLBRosterEntry {
  person: { id: number; fullName: string };
  jerseyNumber: string;
  position: { abbreviation: string; name: string };
  status: { code: string; description: string };
}

export interface RawMLBSearchResult {
  people: Array<{
    id: number;
    fullName: string;
    firstName: string;
    lastName: string;
    primaryNumber?: string;
    currentTeam?: { id: number; name: string; abbreviation: string };
    primaryPosition?: { abbreviation: string };
    currentAge?: number;
    birthDate?: string;
    height?: string;
    weight?: number;
    batSide?: { code: string };
    pitchHand?: { code: string };
    active?: boolean;
    mlbDebutDate?: string;
  }>;
}

// ─── Fetch helpers ────────────────────────────────────────────────────

async function get<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE}${endpoint}`);
  if (!res.ok) throw new Error(`MLB API error ${res.status}: ${endpoint}`);
  return res.json() as Promise<T>;
}

// ─── Teams ────────────────────────────────────────────────────────────

export async function fetchAllMLBTeams(): Promise<RawMLBTeam[]> {
  const data = await get<{ teams: RawMLBTeam[] }>('/teams?sportId=1');
  return data.teams;
}

// ─── Standings types ──────────────────────────────────────────────────

export interface MLBStandingsSplitRecord {
  wins:   number;
  losses: number;
  type:   string;
  pct:    string;
}

export interface MLBStandingsTeamRecord {
  team:               { id: number; name: string };
  wins:               number;
  losses:             number;
  pct:                string;
  gamesBack:          string;
  wildCardGamesBack:  string;
  wildCardRank:       string;
  divisionRank:       string;
  leagueRank:         string;
  divisionLeader:     boolean;
  clinched:           boolean;
  streak:             { streakCode: string };
  runsScored?:        number;
  runsAllowed?:       number;
  records?: {
    splitRecords?:    MLBStandingsSplitRecord[];
    overallRecords?:  MLBStandingsSplitRecord[];
    divisionRecords?: MLBStandingsSplitRecord[];
  };
}

export interface MLBStandingsDivision {
  division:    { id: number; name: string };
  league:      { id: number; name: string };
  teamRecords: MLBStandingsTeamRecord[];
}

export interface MLBStandingsResponse {
  records: MLBStandingsDivision[];
}

export async function fetchTeamStandings(season: number): Promise<MLBStandingsResponse> {
  return get<MLBStandingsResponse>(
    `/standings?leagueId=103,104&season=${season}&standingsType=regularSeason`
  );
}

// ─── Player search ────────────────────────────────────────────────────

export async function searchMLBPlayers(query: string): Promise<RawMLBSearchResult['people']> {
  if (!query || query.trim().length < 2) return [];
  const data = await get<RawMLBSearchResult>(
    `/people/search?names=${encodeURIComponent(query.trim())}&sportId=1&hydrate=currentTeam`
  );
  // Only return active MLB players
  return (data.people ?? []).filter(p => p.active !== false);
}

// ─── Player details ───────────────────────────────────────────────────

export async function fetchMLBPerson(mlbId: number): Promise<RawMLBPerson> {
  const data = await get<{ people: RawMLBPerson[] }>(
    `/people/${mlbId}?hydrate=currentTeam,rosterEntries`
  );
  if (!data.people?.length) throw new Error(`Player ${mlbId} not found`);
  return data.people[0];
}

// ─── Draft info ───────────────────────────────────────────────────────
// MLB Stats API: /people/{id}?hydrate=currentTeam,draft
// Draft info lives in person.drafts[0] (Rule 4 / June Amateur Draft)

export interface RawDraftInfo {
  draftYear?:       number;
  round?:           string;   // "1", "2", ...
  pickNumber?:      number;   // overall pick (e.g. 6)
  roundPickNumber?: number;   // pick within round
  isDrafted?:       boolean;
  school?: {
    name?:  string;
    state?: string;
    country?: string;
  };
  draftTeam?: {
    id?:   number;
    name?: string;
  };
}

export async function fetchDraftInfo(mlbId: number): Promise<RawDraftInfo | null> {
  try {
    const data = await get<{ people: Array<Record<string, unknown>> }>(
      `/people/${mlbId}?hydrate=currentTeam,draft`
    );
    if (!data.people?.length) return null;
    const p = data.people[0] as Record<string, unknown>;
    const draftYear = p.draftYear as number | undefined;
    if (!draftYear) return null;

    // MLB returns an array of draft picks; take the first (earliest / only)
    const drafts = p.drafts as Array<Record<string, unknown>> | undefined;
    const pick   = drafts?.[0];
    if (!pick) return { draftYear };

    return {
      draftYear,
      round:           pick.pickRound       as string  | undefined,
      pickNumber:      pick.pickNumber      as number  | undefined,
      roundPickNumber: pick.roundPickNumber as number  | undefined,
      isDrafted:       pick.isDrafted       as boolean | undefined,
      school:          pick.school          as RawDraftInfo['school']    | undefined,
      draftTeam:       pick.team            as RawDraftInfo['draftTeam'] | undefined,
    };
  } catch {
    return null;
  }
}

// ─── Pitching stats ───────────────────────────────────────────────────

export async function fetchPitchingStats(
  mlbId: number,
  season = 2024
): Promise<RawMLBPitchingStat | null> {
  const data = await get<RawMLBStatsResponse>(
    `/people/${mlbId}/stats?stats=season&group=pitching&season=${season}&sportId=1`
  );
  const group = data.stats?.find(s => s.group.displayName === 'pitching');
  const split = group?.splits?.[0];
  return (split?.stat as RawMLBPitchingStat) ?? null;
}

// ─── Hitting stats ────────────────────────────────────────────────────

export async function fetchHittingStats(
  mlbId: number,
  season = 2024
): Promise<RawMLBHittingStat | null> {
  const data = await get<RawMLBStatsResponse>(
    `/people/${mlbId}/stats?stats=season&group=hitting&season=${season}&sportId=1`
  );
  const group = data.stats?.find(s => s.group.displayName === 'hitting');
  const split = group?.splits?.[0];
  return (split?.stat as RawMLBHittingStat) ?? null;
}

// ─── Advanced hitting (may include Statcast-adjacent metrics) ────────

export interface RawMLBAdvancedHitting {
  exitVelocity?: number;
  launchAngle?: number;
  barrelRate?: number;
  hardHitRate?: number;
  sweetSpotRate?: number;
  sprintSpeed?: number;
  // fallbacks with alternate names
  avgExitVelocity?: number;
  barrelBattedRate?: number;
  hardHitPercent?: number;
}

export async function fetchAdvancedHitting(
  mlbId: number,
  season: number
): Promise<RawMLBAdvancedHitting | null> {
  const types = ['statsSingleSeason', 'advanced', 'statcast'];
  for (const statsType of types) {
    try {
      const data = await get<RawMLBStatsResponse>(
        `/people/${mlbId}/stats?stats=${statsType}&group=hitting&season=${season}&sportId=1`
      );
      const group = data.stats?.find(s => s.group.displayName === 'hitting');
      const split = group?.splits?.[0];
      if (split?.stat) {
        const s = split.stat as unknown as Record<string, unknown>;
        // Check if any Statcast fields came back
        if (s['exitVelocity'] || s['avgExitVelocity'] || s['launchAngle'] || s['barrelRate']) {
          console.info(`[MLB Advanced] Got Statcast data via stats=${statsType}`);
          console.debug('[MLB Advanced] keys:', Object.keys(s));
          return s as RawMLBAdvancedHitting;
        }
      }
    } catch {
      // try next type
    }
  }
  return null;
}

// ─── Sabermetrics (wOBA, wRC+, WAR — no Savant needed) ───────────────

export async function fetchSabermetrics(
  mlbId: number,
  season: number,
  group: 'hitting' | 'pitching' = 'hitting'
): Promise<RawMLBSabermetricsstat | null> {
  try {
    const data = await get<RawMLBStatsResponse>(
      `/people/${mlbId}/stats?stats=sabermetrics&group=${group}&season=${season}&sportId=1`
    );
    const statGroup = data.stats?.find(s => s.type.displayName === 'sabermetrics');
    const split = statGroup?.splits?.[0];
    if (!split?.stat) return null;
    console.debug(`[MLB Sabermetrics/${group}] keys:`, Object.keys(split.stat));
    return normalizeSabermetrics(split.stat as unknown as Record<string, unknown>);
  } catch (e) {
    console.warn(`[MLB Sabermetrics/${group}] fetch failed:`, e);
    return null;
  }
}

/** The MLB Stats API uses inconsistent capitalisation — normalise all variants. */
function normalizeSabermetrics(raw: Record<string, unknown>): RawMLBSabermetricsstat {
  // Helper: try several possible key spellings
  const pick = (...keys: string[]): number => {
    for (const k of keys) {
      const v = raw[k];
      if (v !== undefined && v !== null) return parseFloat(String(v)) || 0;
    }
    return 0;
  };

  return {
    wOBA:    pick('wOBA', 'woba', 'w_oba'),
    wRCPlus: pick('wRCPlus', 'wrcPlus', 'wrc_plus', 'wRC+', 'wRcPlus'),
    war:     pick('war', 'WAR'),
    rar:     pick('rar', 'RAR'),
    spd:     pick('spd', 'speed', 'speedScore'),
    ubr:     pick('ubr', 'UBR'),
    wBsR:    pick('wBsR', 'wbsr'),
    fip:     pick('fip', 'FIP'),
  };
}

// ─── Team roster ──────────────────────────────────────────────────────

export async function fetchTeamRoster(teamId: number): Promise<RawMLBRosterEntry[]> {
  const data = await get<{ roster: RawMLBRosterEntry[] }>(
    `/teams/${teamId}/roster?rosterType=active`
  );
  return data.roster ?? [];
}

/** Hydrated roster entry — includes full person details (age, position, etc.) */
export interface RawMLBRosterPlayerHydrated {
  person: {
    id:               number;
    fullName:         string;
    currentAge?:      number;
    primaryPosition?: { abbreviation: string; name: string };
    currentTeam?:     { id: number; name: string; abbreviation: string };
    mlbDebutDate?:    string;
    batSide?:         { code: string };
    pitchHand?:       { code: string };
  };
  jerseyNumber?: string;
  position: { abbreviation: string; name: string };
  status?:  { code: string; description: string };
}

/**
 * Fetch a team's 40-man roster with full person hydration.
 * rosterType options: '40Man' | 'active' | 'fullSeason' | 'nonRoster'
 */
export async function fetchTeamRoster40Man(
  teamId: number,
  season: number,
  rosterType = '40Man',
): Promise<RawMLBRosterPlayerHydrated[]> {
  try {
    const data = await get<{ roster?: RawMLBRosterPlayerHydrated[] }>(
      `/teams/${teamId}/roster?rosterType=${rosterType}&season=${season}&hydrate=person`
    );
    return data.roster ?? [];
  } catch {
    return [];
  }
}

// ─── MLB Pipeline prospects ──────────────────────────────────────────

/** A single entry from the MLB Pipeline prospect rankings */
export interface RawMLBProspect {
  rank:   number;
  player: {
    id:               number;
    fullName:         string;
    currentAge?:      number;
    primaryPosition?: { abbreviation: string; name: string };
    currentTeam?:     { id: number; name: string; abbreviation: string };
    birthDate?:       string;
  };
}

/**
 * Fetch MLB Pipeline team top-30 prospects.
 * Endpoint: /prospects?orgId={orgId}&season={year}
 */
export async function fetchMLBPipelineTeamProspects(
  orgId: number,
  season: number,
): Promise<RawMLBProspect[]> {
  try {
    const data = await get<{ prospects?: RawMLBProspect[] }>(
      `/prospects?orgId=${orgId}&season=${season}`
    );
    return (data.prospects ?? []).sort((a, b) => a.rank - b.rank);
  } catch {
    return [];
  }
}

/**
 * Fetch MLB Pipeline national Top-100 prospect list.
 * Endpoint: /prospects?season={year}  (no orgId → returns overall rankings)
 */
export async function fetchMLBPipelineTop100(
  season: number,
): Promise<RawMLBProspect[]> {
  try {
    const data = await get<{ prospects?: RawMLBProspect[] }>(
      `/prospects?season=${season}&limit=100`
    );
    return (data.prospects ?? []).sort((a, b) => a.rank - b.rank);
  } catch {
    return [];
  }
}

/**
 * Search all levels of the MLB system (MLB + minors) by name.
 * Used for prospect lookup in the trade analyzer.
 */
export async function searchAllLevelsPlayers(
  query: string,
): Promise<RawMLBSearchResult['people']> {
  if (!query || query.trim().length < 2) return [];
  try {
    // No sportId filter → returns all levels (MLB + AAA + AA + A + Rookie)
    const data = await get<RawMLBSearchResult>(
      `/people/search?names=${encodeURIComponent(query.trim())}`
    );
    return data.people ?? [];
  } catch {
    return [];
  }
}

// ─── Static team ID → abbreviation map ───────────────────────────────
// MLB Stats API game log splits include opponent.id but not opponent.abbreviation

const MLB_TEAM_ABBREV: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS',
  112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL',
  116: 'DET', 117: 'HOU', 118: 'KC',  119: 'LAD',
  120: 'WSH', 121: 'NYM', 133: 'OAK', 134: 'PIT',
  135: 'SD',  136: 'SEA', 137: 'SF',  138: 'STL',
  139: 'TB',  140: 'TEX', 141: 'TOR', 142: 'MIN',
  143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA',
  147: 'NYY', 158: 'MIL',
};

function oppAbbrev(raw: Record<string, unknown>): string {
  const opp = raw['opponent'] as Record<string, unknown> | undefined;
  const id  = Number(opp?.['id'] ?? 0);
  return MLB_TEAM_ABBREV[id] ?? String(opp?.['abbreviation'] ?? opp?.['name'] ?? '');
}

// ─── Game log (game-by-game hitting stats for trends) ─────────────────

export interface GameLogEntry {
  date: string;
  opponent?: string;
  isHome?: boolean;
  atBats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  runs?: number;
  rbi?: number;
  walks: number;
  intentionalWalks: number;
  hitByPitch: number;
  sacFlies: number;
  strikeouts: number;
  stolenBases?: number;
  pa?: number;
}

export async function fetchGameLog(
  mlbId: number,
  season: number
): Promise<GameLogEntry[]> {
  const data = await get<RawMLBStatsResponse>(
    `/people/${mlbId}/stats?stats=gameLog&group=hitting&season=${season}&sportId=1`
  );
  const group = data.stats?.find(s => s.type.displayName === 'gameLog');
  if (!group?.splits?.length) return [];

  return group.splits.map(split => {
    const s   = split.stat as RawMLBHittingStat;
    const raw = split as Record<string, unknown>;
    const opp = raw['opponent'] as Record<string, unknown> | undefined;
    const singles = Math.max(0, (s.hits ?? 0) - (s.doubles ?? 0) - (s.triples ?? 0) - (s.homeRuns ?? 0));
    return {
      date:             raw['date'] as string ?? '',
      opponent:         oppAbbrev(raw),
      isHome:           Boolean(raw['isHome']),
      atBats:           s.atBats           ?? 0,
      hits:             s.hits             ?? 0,
      singles,
      doubles:          s.doubles          ?? 0,
      triples:          s.triples          ?? 0,
      homeRuns:         s.homeRuns         ?? 0,
      runs:             s.runs             ?? 0,
      rbi:              s.rbi              ?? 0,
      walks:            s.baseOnBalls      ?? 0,
      intentionalWalks: s.intentionalWalks ?? 0,
      hitByPitch:       s.hitByPitch       ?? 0,
      sacFlies:         s.sacFlies         ?? 0,
      strikeouts:       s.strikeOuts       ?? 0,
      stolenBases:      s.stolenBases      ?? 0,
      pa:               s.plateAppearances ?? (s.atBats + (s.baseOnBalls ?? 0) + (s.hitByPitch ?? 0) + (s.sacFlies ?? 0)),
    };
  });
}

// ─── Pitch arsenal ───────────────────────────────────────────────────

export interface RawMLBPitchArsenalEntry {
  type: { displayName: string; code?: string; description?: string };
  count?: number;
  percentage: number;         // 0.0–1.0
  totalPitches?: number;
  averageSpeed: number;       // mph  — API field is "averageSpeed", not "avgSpeed"
  avgSpin?: number;           // rpm  — not always present in the API response
}

export async function fetchPitchArsenal(
  mlbId: number,
  season: number
): Promise<RawMLBPitchArsenalEntry[]> {
  try {
    const data = await get<RawMLBStatsResponse>(
      `/people/${mlbId}/stats?stats=pitchArsenal&group=pitching&season=${season}&sportId=1`
    );
    // The pitchArsenal endpoint nests each pitch type as a separate split
    const group = data.stats?.find(s =>
      s.type?.displayName === 'pitchArsenal' ||
      (s.group?.displayName === 'pitching' && s.splits?.length > 0 && (s.splits[0]?.stat as any)?.type?.displayName)
    );
    if (!group?.splits?.length) return [];
    return group.splits
      .map(s => s.stat as unknown as RawMLBPitchArsenalEntry)
      .filter(e => e?.percentage > 0.01); // filter out sub-1% pitch types
  } catch {
    return [];
  }
}

// ─── Pitcher game log ─────────────────────────────────────────────────

export interface PitcherGameLogEntry {
  date: string;
  opponent: string;
  isHome: boolean;
  gameIndex: number;
  ip: number;
  h: number;
  k: number;
  bb: number;
  er: number;
  runs: number;   // total runs (earned + unearned)
  hr: number;
  bf: number;
  pc: number;
  w: number;
  l: number;
  sv: number;
  decision: string; // 'W' | 'L' | 'S' | ''
  k9: number;
  whip: number;
  era: number;
}

function parseIPLocal(ip: string): number {
  const [whole, frac] = (ip ?? '0').split('.');
  return parseInt(whole, 10) + (parseInt(frac ?? '0', 10) / 3);
}

export async function fetchPitcherGameLog(
  mlbId: number,
  season: number
): Promise<PitcherGameLogEntry[]> {
  try {
    const data = await get<RawMLBStatsResponse>(
      `/people/${mlbId}/stats?stats=gameLog&group=pitching&season=${season}&sportId=1`
    );
    const group = data.stats?.find(s => s.type.displayName === 'gameLog');
    if (!group?.splits?.length) return [];
    // First pass: build raw entries
    const raw = group.splits.map((split, i) => {
      const s    = split.stat as RawMLBPitchingStat & { earnedRuns?: number; runs?: number };
      const rec  = split as Record<string, unknown>;
      const ip   = parseIPLocal(s.inningsPitched ?? '0');
      const k    = s.strikeOuts      ?? 0;
      const bb   = s.baseOnBalls     ?? 0;
      const er   = s.earnedRuns      ?? 0;
      const runs = s.runs            ?? er;
      const h    = s.hits            ?? 0;
      const hr   = s.homeRuns        ?? 0;
      const bf   = s.battersFaced    ?? 1;
      const pc   = s.numberOfPitches ?? 0;
      const w    = s.wins   ?? 0;
      const l    = s.losses ?? 0;
      const sv   = s.saves  ?? 0;
      return {
        date:      rec['date'] as string ?? '',
        opponent:  oppAbbrev(rec),
        isHome:    Boolean(rec['isHome']),
        gameIndex: i + 1,
        ip, h, k, bb, er, runs, hr, bf, pc, w, l, sv,
        decision:  w > 0 ? 'W' : l > 0 ? 'L' : sv > 0 ? 'S' : '',
        k9:        ip > 0 ? parseFloat(((k / ip) * 9).toFixed(1)) : 0,
        whip:      ip > 0 ? parseFloat(((bb + h) / ip).toFixed(2)) : 0,
      };
    });

    // Second pass: compute running season ERA (cumulative ER / cumulative IP * 9)
    // so the ERA column matches the season total up to and including each game.
    let cumIP = 0;
    let cumER = 0;
    return raw.map(entry => {
      cumIP += entry.ip;
      cumER += entry.er;
      const seasonEra = cumIP > 0
        ? parseFloat(((cumER / cumIP) * 9).toFixed(2))
        : 0;
      return { ...entry, era: seasonEra };
    });
  } catch {
    return [];
  }
}

// ─── L/R splits ──────────────────────────────────────────────────────

export interface HittingSplitEntry {
  split:  string;
  label:  string;
  pa:     number;
  ab:     number;
  avg:    string;
  obp:    string;
  slg:    string;
  ops:    string;
  hr:     number;
  rbi:    number;
  bb:     number;
  k:      number;
  sb:     number;
  babip:  string;
}

export interface PitchingSplitEntry {
  split:  string;
  label:  string;
  ip:     number;
  bf:     number;
  k:      number;
  bb:     number;
  er:     number;
  hr:     number;
  avg:    string;
  obp:    string;
  slg:    string;
  k9:     number;
  bb9:    number;
  era:    number;
}

export interface HittingSplitsData {
  vsLeft:  HittingSplitEntry | null;
  vsRight: HittingSplitEntry | null;
  home:    HittingSplitEntry | null;
  away:    HittingSplitEntry | null;
  last7:   HittingSplitEntry | null;
  last30:  HittingSplitEntry | null;
  day:     HittingSplitEntry | null;
  night:   HittingSplitEntry | null;
}

export interface PitchingSplitsData {
  vsLeft:  PitchingSplitEntry | null;
  vsRight: PitchingSplitEntry | null;
  home:    PitchingSplitEntry | null;
  away:    PitchingSplitEntry | null;
  last7:   PitchingSplitEntry | null;
  last30:  PitchingSplitEntry | null;
  day:     PitchingSplitEntry | null;
  night:   PitchingSplitEntry | null;
}

function toHittingEntry(sp: Record<string, unknown>, split: string, label: string): HittingSplitEntry | null {
  if (!sp) return null;
  const s = sp['stat'] as RawMLBHittingStat;
  if (!s) return null;
  const pa = s.plateAppearances ?? 0;
  if (pa === 0 && (s.atBats ?? 0) === 0) return null; // skip truly empty splits
  return {
    split, label,
    pa,
    ab:    s.atBats           ?? 0,
    avg:   String(s.avg   ?? '.000'),
    obp:   String(s.obp   ?? '.000'),
    slg:   String(s.slg   ?? '.000'),
    ops:   String(s.ops   ?? '.000'),
    hr:    s.homeRuns         ?? 0,
    rbi:   s.rbi              ?? 0,
    bb:    s.baseOnBalls      ?? 0,
    k:     s.strikeOuts       ?? 0,
    sb:    s.stolenBases      ?? 0,
    babip: String(s.babip ?? '.000'),
  };
}

function toPitchingEntry(sp: Record<string, unknown>, split: string, label: string): PitchingSplitEntry | null {
  if (!sp) return null;
  const s = sp['stat'] as RawMLBPitchingStat & { earnedRuns?: number };
  if (!s) return null;
  const ip  = parseIPLocal(s.inningsPitched ?? '0');
  if (ip === 0 && (s.battersFaced ?? 0) === 0) return null; // skip truly empty splits
  const k   = s.strikeOuts  ?? 0;
  const bb  = s.baseOnBalls ?? 0;
  const er  = s.earnedRuns  ?? 0;
  return {
    split, label,
    ip, k, bb, er,
    bf:  s.battersFaced ?? 0,
    hr:  s.homeRuns     ?? 0,
    avg: String(s.avg   ?? '.000'),
    obp: String(s.obp   ?? '.000'),
    slg: String(s.slg   ?? '.000'),
    k9:  ip > 0 ? parseFloat(((k  / ip) * 9).toFixed(1)) : 0,
    bb9: ip > 0 ? parseFloat(((bb / ip) * 9).toFixed(1)) : 0,
    era: ip > 0 ? parseFloat(((er / ip) * 9).toFixed(2)) : 0,
  };
}

// sitCode → { key in result, label }
const HIT_SPLIT_MAP: Array<{ code: string; key: keyof HittingSplitsData; label: string }> = [
  { code: 'vl',  key: 'vsLeft',  label: 'vs. LHP'    },
  { code: 'vr',  key: 'vsRight', label: 'vs. RHP'    },
  { code: 'h',   key: 'home',    label: 'Home'       },
  { code: 'a',   key: 'away',    label: 'Away'       },
  { code: 'l7',  key: 'last7',   label: 'Last 7 Days'},
  { code: 'l30', key: 'last30',  label: 'Last 30 Days'},
  { code: 'd',   key: 'day',     label: 'Day'        },
  { code: 'n',   key: 'night',   label: 'Night'      },
];

const PITCH_SPLIT_MAP: Array<{ code: string; key: keyof PitchingSplitsData; label: string }> = [
  { code: 'vl',  key: 'vsLeft',  label: 'vs. LHB'    },
  { code: 'vr',  key: 'vsRight', label: 'vs. RHB'    },
  { code: 'h',   key: 'home',    label: 'Home'       },
  { code: 'a',   key: 'away',    label: 'Away'       },
  { code: 'l7',  key: 'last7',   label: 'Last 7 Days'},
  { code: 'l30', key: 'last30',  label: 'Last 30 Days'},
  { code: 'd',   key: 'day',     label: 'Day'        },
  { code: 'n',   key: 'night',   label: 'Night'      },
];

export async function fetchHittingSplits(
  mlbId: number,
  season: number
): Promise<HittingSplitsData> {
  const empty: HittingSplitsData = {
    vsLeft: null, vsRight: null, home: null, away: null,
    last7: null, last30: null, day: null, night: null,
  };
  try {
    const codes = HIT_SPLIT_MAP.map(m => m.code).join(',');
    const data = await get<Record<string, unknown>>(
      `/people/${mlbId}/stats?stats=statSplits&group=hitting&season=${season}&sitCodes=${codes}&sportId=1`
    );
    const stats = data['stats'] as Array<Record<string, unknown>>;
    const group = stats?.find(s =>
      (s['type'] as Record<string, unknown>)?.['displayName'] === 'statSplits'
    );
    const splits = (group?.['splits'] as Array<Record<string, unknown>>) ?? [];

    // Debug: log all split codes the API returned so we can verify they match
    const returnedCodes = splits.map(s => (s['split'] as Record<string, unknown>)?.['code']);
    console.info('[Hitting Splits] returned codes:', returnedCodes);

    const result = { ...empty };
    for (const { code, key, label } of HIT_SPLIT_MAP) {
      const sp = splits.find(s => (s['split'] as Record<string, unknown>)?.['code'] === code);
      if (sp) result[key] = toHittingEntry(sp, code, label);
    }
    console.info('[Hitting Splits] result:', Object.fromEntries(
      Object.entries(result).map(([k, v]) => [k, v ? `${v.pa} PA` : 'null'])
    ));
    return result;
  } catch (e) {
    console.warn('[Hitting Splits] fetch failed:', e);
    return empty;
  }
}

export async function fetchPitchingSplits(
  mlbId: number,
  season: number
): Promise<PitchingSplitsData> {
  const empty: PitchingSplitsData = {
    vsLeft: null, vsRight: null, home: null, away: null,
    last7: null, last30: null, day: null, night: null,
  };
  try {
    const codes = PITCH_SPLIT_MAP.map(m => m.code).join(',');
    const data = await get<Record<string, unknown>>(
      `/people/${mlbId}/stats?stats=statSplits&group=pitching&season=${season}&sitCodes=${codes}&sportId=1`
    );
    const stats = data['stats'] as Array<Record<string, unknown>>;
    const group = stats?.find(s =>
      (s['type'] as Record<string, unknown>)?.['displayName'] === 'statSplits'
    );
    const splits = (group?.['splits'] as Array<Record<string, unknown>>) ?? [];

    const returnedCodes = splits.map(s => (s['split'] as Record<string, unknown>)?.['code']);
    console.info('[Pitching Splits] returned codes:', returnedCodes);

    const result = { ...empty };
    for (const { code, key, label } of PITCH_SPLIT_MAP) {
      const sp = splits.find(s => (s['split'] as Record<string, unknown>)?.['code'] === code);
      if (sp) result[key] = toPitchingEntry(sp, code, label);
    }
    return result;
  } catch (e) {
    console.warn('[Pitching Splits] fetch failed:', e);
    return empty;
  }
}

// ─── Career year-by-year stats ────────────────────────────────────────

function parseIPCareer(ip: string | undefined): number {
  if (!ip) return 0;
  const [w, f] = ip.split('.');
  return parseInt(w, 10) + (parseInt(f ?? '0', 10) / 3);
}

async function fetchWarForSeasons(mlbId: number, seasons: string[], group: 'hitting' | 'pitching'): Promise<Record<string, number>> {
  const results = await Promise.allSettled(
    seasons.map(season => fetchSabermetrics(mlbId, parseInt(season, 10), group))
  );
  const map: Record<string, number> = {};
  seasons.forEach((season, i) => {
    const r = results[i];
    if (r.status === 'fulfilled' && r.value?.war) {
      map[season] = Math.round(r.value.war * 10) / 10;
    }
  });
  return map;
}

export async function fetchCareerHitting(mlbId: number): Promise<CareerHittingSeason[]> {
  const data = await get<{ stats: Array<{ group: { displayName: string }; splits: Array<Record<string, unknown>> }> }>(
    `/people/${mlbId}/stats?stats=yearByYear&group=hitting&sportId=1&gameType=R&hydrate=team`
  );
  const group = data.stats?.find(s => s.group.displayName === 'hitting');
  if (!group) return [];
  const splits = (group.splits ?? []).filter(sp => sp.season && (sp.stat as Record<string, unknown>)?.gamesPlayed);
  const seasons = [...new Set(splits.map(sp => String(sp.season)))];
  const warMap = await fetchWarForSeasons(mlbId, seasons, 'hitting');

  // Count how many team-specific splits exist per season (for multi-team "n Teams" label)
  const teamsPerSeason: Record<string, number> = {};
  for (const sp of splits) {
    const season = String(sp.season);
    const team = sp.team as Record<string, unknown> | undefined;
    const abbr = team?.abbreviation ?? team?.teamCode ?? team?.abbreviationFull ?? '';
    if (abbr) teamsPerSeason[season] = (teamsPerSeason[season] ?? 0) + 1;
  }

  return splits.map(sp => {
    const s = sp.stat as Record<string, unknown>;
    const season = String(sp.season);
    const team = (sp.team as Record<string, unknown> | undefined);
    const abbr = team?.abbreviation ?? team?.teamCode ?? team?.abbreviationFull ?? '';
    const teamCount = teamsPerSeason[season] ?? 1;
    return {
      season,
      teamAbbr: abbr ? String(abbr) : `${teamCount} Teams`,
      teamName: String(team?.name ?? '—'),
      g:        Number(s.gamesPlayed ?? 0),
      pa:       Number(s.plateAppearances ?? 0),
      ab:       Number(s.atBats ?? 0),
      h:        Number(s.hits ?? 0),
      doubles:  Number(s.doubles ?? 0),
      triples:  Number(s.triples ?? 0),
      hr:       Number(s.homeRuns ?? 0),
      rbi:      Number(s.rbi ?? 0),
      r:        Number(s.runs ?? 0),
      sb:       Number(s.stolenBases ?? 0),
      avg:      parseFloat(String(s.avg ?? '0')),
      obp:      parseFloat(String(s.obp ?? '0')),
      slg:      parseFloat(String(s.slg ?? '0')),
      ops:      parseFloat(String(s.ops ?? '0')),
      bb:       Number(s.baseOnBalls ?? 0),
      k:        Number(s.strikeOuts ?? 0),
      war:      warMap[season] ?? 0,
    };
  });
}

export async function fetchCareerPitching(mlbId: number): Promise<CareerPitchingSeason[]> {
  const data = await get<{ stats: Array<{ group: { displayName: string }; splits: Array<Record<string, unknown>> }> }>(
    `/people/${mlbId}/stats?stats=yearByYear&group=pitching&sportId=1&gameType=R&hydrate=team`
  );
  const group = data.stats?.find(s => s.group.displayName === 'pitching');
  if (!group) return [];
  const splits = (group.splits ?? []).filter(sp => sp.season && (sp.stat as Record<string, unknown>)?.gamesPlayed);
  const seasons = [...new Set(splits.map(sp => String(sp.season)))];
  const warMap = await fetchWarForSeasons(mlbId, seasons, 'pitching');

  // Count how many team-specific splits exist per season (for multi-team "n Teams" label)
  const teamsPerSeason: Record<string, number> = {};
  for (const sp of splits) {
    const season = String(sp.season);
    const team = sp.team as Record<string, unknown> | undefined;
    const abbr = team?.abbreviation ?? team?.teamCode ?? team?.abbreviationFull ?? '';
    if (abbr) teamsPerSeason[season] = (teamsPerSeason[season] ?? 0) + 1;
  }

  return splits.map(sp => {
    const s  = sp.stat as Record<string, unknown>;
    const season = String(sp.season);
    const team = (sp.team as Record<string, unknown> | undefined);
    const abbr = team?.abbreviation ?? team?.teamCode ?? team?.abbreviationFull ?? '';
    const teamCount = teamsPerSeason[season] ?? 1;
    const ip = parseIPCareer(String(s.inningsPitched ?? '0'));
    return {
      season,
      teamAbbr: abbr ? String(abbr) : `${teamCount} Teams`,
      teamName: String(team?.name ?? '—'),
      g:    Number(s.gamesPlayed ?? 0),
      gs:   Number(s.gamesStarted ?? 0),
      w:    Number(s.wins ?? 0),
      l:    Number(s.losses ?? 0),
      sv:   Number(s.saves ?? 0),
      ip,
      era:  parseFloat(String(s.era ?? '0')),
      whip: parseFloat(String(s.whip ?? '0')),
      k9:   ip > 0 ? (Number(s.strikeOuts ?? 0) / ip) * 9 : 0,
      bb9:  ip > 0 ? (Number(s.baseOnBalls ?? 0) / ip) * 9 : 0,
      k:    Number(s.strikeOuts ?? 0),
      bb:   Number(s.baseOnBalls ?? 0),
      hr:   Number(s.homeRuns ?? 0),
      war:  warMap[season] ?? 0,
    };
  });
}

// ─── Positions played this season ─────────────────────────────────────

export interface PositionAppearance {
  pos: string;   // abbreviation, e.g. "LF", "2B", "DH"
  games: number;
}

export async function fetchPositionsPlayed(
  mlbId: number,
  season: number,
): Promise<PositionAppearance[]> {
  try {
    const data = await get<{ stats: Array<{ splits: Array<Record<string, unknown>> }> }>(
      `/people/${mlbId}/stats?stats=season&group=fielding&season=${season}&sportId=1`
    );
    const splits = data.stats?.[0]?.splits ?? [];
    return splits.map(sp => ({
      pos:   (sp.position as Record<string, string>)?.abbreviation ?? '?',
      games: Number((sp.stat as Record<string, unknown>)?.gamesPlayed ?? 0),
    })).filter(p => p.games > 0);
  } catch {
    return [];
  }
}

// ─── Career totals (single-row summary from stats=career endpoint) ────

export interface CareerHittingTotals {
  g: number; pa: number; ab: number;
  h: number; doubles: number; triples: number; hr: number;
  rbi: number; r: number; sb: number; bb: number; k: number;
  avg: number; obp: number; slg: number; ops: number;
}

export interface CareerPitchingTotals {
  g: number; gs: number; w: number; l: number; sv: number;
  ip: number; k: number; bb: number; hr: number;
  era: number; whip: number; k9: number; bb9: number;
}

export async function fetchCareerHittingTotals(mlbId: number): Promise<CareerHittingTotals | null> {
  try {
    const data = await get<{ stats: Array<{ group: { displayName: string }; splits: Array<Record<string, unknown>> }> }>(
      `/people/${mlbId}/stats?stats=career&group=hitting&sportId=1&gameType=R`
    );
    const group = data.stats?.find(s => s.group.displayName === 'hitting');
    if (!group?.splits?.length) return null;
    const s = group.splits[0].stat as Record<string, unknown>;
    return {
      g:       Number(s.gamesPlayed ?? 0),
      pa:      Number(s.plateAppearances ?? 0),
      ab:      Number(s.atBats ?? 0),
      h:       Number(s.hits ?? 0),
      doubles: Number(s.doubles ?? 0),
      triples: Number(s.triples ?? 0),
      hr:      Number(s.homeRuns ?? 0),
      rbi:     Number(s.rbi ?? 0),
      r:       Number(s.runs ?? 0),
      sb:      Number(s.stolenBases ?? 0),
      bb:      Number(s.baseOnBalls ?? 0),
      k:       Number(s.strikeOuts ?? 0),
      avg:     parseFloat(String(s.avg ?? '0')),
      obp:     parseFloat(String(s.obp ?? '0')),
      slg:     parseFloat(String(s.slg ?? '0')),
      ops:     parseFloat(String(s.ops ?? '0')),
    };
  } catch { return null; }
}

export async function fetchCareerPitchingTotals(mlbId: number): Promise<CareerPitchingTotals | null> {
  try {
    const data = await get<{ stats: Array<{ group: { displayName: string }; splits: Array<Record<string, unknown>> }> }>(
      `/people/${mlbId}/stats?stats=career&group=pitching&sportId=1&gameType=R`
    );
    const group = data.stats?.find(s => s.group.displayName === 'pitching');
    if (!group?.splits?.length) return null;
    const s = group.splits[0].stat as Record<string, unknown>;
    const ip = parseIPCareer(String(s.inningsPitched ?? '0'));
    const k  = Number(s.strikeOuts ?? 0);
    const bb = Number(s.baseOnBalls ?? 0);
    return {
      g:    Number(s.gamesPlayed ?? 0),
      gs:   Number(s.gamesStarted ?? 0),
      w:    Number(s.wins ?? 0),
      l:    Number(s.losses ?? 0),
      sv:   Number(s.saves ?? 0),
      ip,
      k,
      bb,
      hr:   Number(s.homeRuns ?? 0),
      era:  parseFloat(String(s.era ?? '0')),
      whip: parseFloat(String(s.whip ?? '0')),
      k9:   ip > 0 ? (k  / ip) * 9 : 0,
      bb9:  ip > 0 ? (bb / ip) * 9 : 0,
    };
  } catch { return null; }
}

// ─── Team schedule (recent & upcoming games) ─────────────────────────

export interface TeamScheduleGame {
  gamePk:     number;
  gameDate:   string;          // ISO date string
  status:     string;          // 'Final' | 'In Progress' | 'Preview' | etc.
  isHome:     boolean;
  opponent:   { id: number; name: string; abbreviation: string };
  score?:     { home: number; away: number };
  isWin?:     boolean;
  seriesInfo?: string;
}

export async function fetchTeamRecentSchedule(
  teamId: number,
  season: number,
): Promise<TeamScheduleGame[]> {
  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);

    const fmt = (d: Date) =>
      `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;

    const data = await get<{
      dates: Array<{
        date: string;
        games: Array<Record<string, unknown>>;
      }>;
    }>(
      `/schedule?teamId=${teamId}&season=${season}&sportId=1&gameType=R` +
      `&startDate=${fmt(startDate)}&endDate=${fmt(endDate)}` +
      `&hydrate=team,linescore`
    );

    const games: TeamScheduleGame[] = [];
    for (const dateEntry of data.dates ?? []) {
      for (const g of dateEntry.games ?? []) {
        const teams = g['teams'] as Record<string, Record<string, unknown>> | undefined;
        if (!teams) continue;
        const homeTeam = teams['home'];
        const awayTeam = teams['away'];
        const homeId   = Number((homeTeam?.['team'] as Record<string, unknown>)?.['id'] ?? 0);
        const isHome   = homeId === teamId;
        const myTeam   = isHome ? homeTeam : awayTeam;
        const oppRaw   = isHome ? awayTeam : homeTeam;
        const oppTeam  = (oppRaw?.['team'] as Record<string, unknown>) ?? {};

        const status   = (g['status'] as Record<string, unknown>)?.['detailedState'] as string ?? '';
        const isFinal  = status.toLowerCase().includes('final');

        let score: { home: number; away: number } | undefined;
        let isWin: boolean | undefined;
        if (isFinal) {
          const myScore  = Number(myTeam?.['score'] ?? 0);
          const oppScore = Number(oppRaw?.['score'] ?? 0);
          score   = { home: isHome ? myScore : oppScore, away: isHome ? oppScore : myScore };
          isWin   = myScore > oppScore;
        }

        games.push({
          gamePk:    Number(g['gamePk'] ?? 0),
          gameDate:  dateEntry.date,
          status,
          isHome,
          opponent: {
            id:           Number(oppTeam['id'] ?? 0),
            name:         String(oppTeam['name'] ?? ''),
            abbreviation: String(oppTeam['abbreviation'] ?? MLB_TEAM_ABBREV[Number(oppTeam['id'])] ?? ''),
          },
          score,
          isWin,
        });
      }
    }

    return games.sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  } catch (e) {
    console.warn('[Team Schedule] fetch failed:', e);
    return [];
  }
}

// ─── Team season batting / pitching totals ────────────────────────────

export interface TeamSeasonStats {
  batting: {
    avg: string; obp: string; slg: string; ops: string;
    r: number; h: number; hr: number; rbi: number; sb: number;
    bb: number; k: number; pa: number;
  } | null;
  pitching: {
    era: string; whip: string; k9: string; bb9: string;
    w: number; l: number; sv: number; ip: string;
    k: number; bb: number; hr: number; r: number;
  } | null;
}

export async function fetchTeamSeasonStats(
  teamId: number,
  season: number,
): Promise<TeamSeasonStats> {
  try {
    const [hitData, pitData] = await Promise.all([
      get<RawMLBStatsResponse>(
        `/teams/${teamId}/stats?stats=season&group=hitting&season=${season}&sportId=1`
      ).catch(() => null),
      get<RawMLBStatsResponse>(
        `/teams/${teamId}/stats?stats=season&group=pitching&season=${season}&sportId=1`
      ).catch(() => null),
    ]);

    const hitSplit  = hitData?.stats?.[0]?.splits?.[0]?.stat as RawMLBHittingStat | undefined;
    const pitSplit  = pitData?.stats?.[0]?.splits?.[0]?.stat as RawMLBPitchingStat & { earnedRuns?: number } | undefined;

    const ip = parseIPLocal(pitSplit?.inningsPitched ?? '0');

    return {
      batting: hitSplit ? {
        avg:  String(hitSplit.avg  ?? '.000'),
        obp:  String(hitSplit.obp  ?? '.000'),
        slg:  String(hitSplit.slg  ?? '.000'),
        ops:  String(hitSplit.ops  ?? '.000'),
        r:    hitSplit.runs         ?? 0,
        h:    hitSplit.hits         ?? 0,
        hr:   hitSplit.homeRuns     ?? 0,
        rbi:  hitSplit.rbi          ?? 0,
        sb:   hitSplit.stolenBases  ?? 0,
        bb:   hitSplit.baseOnBalls  ?? 0,
        k:    hitSplit.strikeOuts   ?? 0,
        pa:   hitSplit.plateAppearances ?? 0,
      } : null,
      pitching: pitSplit ? {
        era:  String(pitSplit.era  ?? '0.00'),
        whip: String(pitSplit.whip ?? '0.00'),
        k9:   ip > 0 ? ((pitSplit.strikeOuts ?? 0) / ip * 9).toFixed(1) : '0.0',
        bb9:  ip > 0 ? ((pitSplit.baseOnBalls ?? 0) / ip * 9).toFixed(1) : '0.0',
        w:    pitSplit.wins   ?? 0,
        l:    pitSplit.losses ?? 0,
        sv:   pitSplit.saves  ?? 0,
        ip:   pitSplit.inningsPitched ?? '0.0',
        k:    pitSplit.strikeOuts  ?? 0,
        bb:   pitSplit.baseOnBalls ?? 0,
        hr:   pitSplit.homeRuns    ?? 0,
        r:    pitSplit.earnedRuns  ?? 0,
      } : null,
    };
  } catch (e) {
    console.warn('[Team Season Stats] fetch failed:', e);
    return { batting: null, pitching: null };
  }
}

// ─── Combined player + stats fetch ───────────────────────────────────

export async function fetchFullPlayerData(mlbId: number, season = 2024) {
  const [person, pitching, hitting] = await Promise.all([
    fetchMLBPerson(mlbId),
    fetchPitchingStats(mlbId, season).catch(() => null),
    fetchHittingStats(mlbId, season).catch(() => null),
  ]);
  return { person, pitching, hitting };
}
