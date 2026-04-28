/**
 * TanStack Query hooks for MLB Stats API + Baseball Savant data.
 * All data is cached and deduped automatically via React Query.
 */

import { useQuery } from '@tanstack/react-query';
import {
  searchMLBPlayers,
  fetchMLBPerson,
  fetchPitchingStats,
  fetchHittingStats,
  fetchSabermetrics,
  fetchAdvancedHitting,
  fetchGameLog,
  fetchAllMLBTeams,
  fetchPitchArsenal,
  fetchPitcherGameLog,
  fetchTeamStandings,
  fetchTeamRoster40Man,
  searchAllLevelsPlayers,
  fetchCareerHitting,
  fetchCareerPitching,
  fetchMLBPipelineTeamProspects,
  fetchMLBPipelineTop100,
  fetchHittingSplits,
  fetchPitchingSplits,
  fetchTeamRecentSchedule,
  fetchTeamSeasonStats,
  type RawMLBPitchArsenalEntry,
  type PitcherGameLogEntry,
  type RawMLBRosterPlayerHydrated,
  type RawMLBTeam,
  type RawMLBProspect,
  type HittingSplitEntry,
  type PitchingSplitEntry,
  type HittingSplitsData,
  type PitchingSplitsData,
  type CareerHittingSeason,
  type CareerPitchingSeason,
  type TeamScheduleGame,
  type TeamSeasonStats,
} from '../data/api/mlbStats';
import {
  fetchSavantBatterById,
  fetchSavantPitcherById,
  fetchSavantBatters,
  fetchSavantPitchers,
  fetchPitchSpinById,
  fetchStatcastSprayChart,
  fetchStatcastZoneData,
  computeBatterSavantPercentiles,
  computePitcherSavantPercentiles,
} from '../data/api/savant';
import {
  fetchFanGraphsPitcherById,
  fetchFanGraphsFieldingById,
  fetchFanGraphsFieldingLeaderboard,
  fetchFanGraphsBattingLeaderboard,
  fetchFanGraphsPitchingLeaderboard,
  fetchFanGraphsBatterById,
  computeWrcPlusPercentile,
  computeERAPercentile,
} from '../data/api/fangraphs';
import {
  transformPerson,
  transformTeam,
  transformPitchingStats,
  transformHittingStats,
} from '../data/api/transformers';
import type { Player, Team, PitchingStats, HittingStats } from '../data/types';

const CURRENT_YEAR = new Date().getFullYear();
const SEASON = CURRENT_YEAR;

/**
 * Fetch Savant data for a player, automatically falling back to the previous
 * season if the current season returns nothing (e.g. early in the year before
 * the leaderboard has accumulated enough PA to appear).
 */
async function fetchSavantBatterWithFallback(mlbId: number, year: number) {
  try {
    const result = await fetchSavantBatterById(mlbId, year);
    if (result) { console.info(`[Savant] Batter ${mlbId} loaded from ${year}`); return result; }
    // Empty result — try previous season
    if (year > 2021) {
      console.info(`[Savant] No batter data for ${year}, trying ${year - 1}…`);
      const prev = await fetchSavantBatterById(mlbId, year - 1);
      if (prev) { console.info(`[Savant] Batter ${mlbId} loaded from ${year - 1}`); return prev; }
    }
    console.warn(`[Savant] Batter ${mlbId}: no data found for ${year} or ${year - 1}`);
    return null;
  } catch (e) {
    console.warn(`[Savant] Batter fetch failed — proxy may be down. Restart dev server.\n`, e);
    return null;
  }
}

async function fetchSavantPitcherWithFallback(mlbId: number, year: number) {
  try {
    const result = await fetchSavantPitcherById(mlbId, year);
    if (result) { console.info(`[Savant] Pitcher ${mlbId} loaded from ${year}`); return result; }
    if (year > 2021) {
      console.info(`[Savant] No pitcher data for ${year}, trying ${year - 1}…`);
      const prev = await fetchSavantPitcherById(mlbId, year - 1);
      if (prev) { console.info(`[Savant] Pitcher ${mlbId} loaded from ${year - 1}`); return prev; }
    }
    console.warn(`[Savant] Pitcher ${mlbId}: no data found for ${year} or ${year - 1}`);
    return null;
  } catch (e) {
    console.warn(`[Savant] Pitcher fetch failed — proxy may be down. Restart dev server.\n`, e);
    return null;
  }
}

// ─── Player search ─────────────────────────────────────────────────────

export function usePlayerSearch(query: string) {
  return useQuery({
    queryKey: ['playerSearch', query],
    queryFn: () => searchMLBPlayers(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,   // 5 min — search results don't change often
    placeholderData: [],
  });
}

// ─── Player bio ────────────────────────────────────────────────────────

export function usePlayer(mlbId: number | null): {
  player: Player | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['player', mlbId],
    queryFn: async () => {
      const person = await fetchMLBPerson(mlbId!);
      return transformPerson(person);
    },
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 10 * 60 * 1000,
  });

  return {
    player: data ?? null,
    isLoading,
    error: error as Error | null,
  };
}

// ─── Pitching stats (MLB Stats API + Savant overlay) ──────────────────

export function usePitchingStats(mlbId: number | null): {
  stats: PitchingStats | null;
  savantLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pitchingStats', mlbId, SEASON],
    queryFn: async () => {
      const [raw, savant, saber, fg] = await Promise.all([
        fetchPitchingStats(mlbId!, SEASON),
        fetchSavantPitcherWithFallback(mlbId!, SEASON),
        fetchSabermetrics(mlbId!, SEASON, 'pitching'),
        fetchFanGraphsPitcherById(mlbId!, SEASON),
      ]);
      if (!raw) return { stats: null, savantLoaded: false };
      // Merge FanGraphs chase rate into savant object (Savant doesn't provide it via leaderboard)
      const mergedSavant = savant ? {
        ...savant,
        chasePct: fg?.oSwingPct ?? savant.chasePct,
      } : savant;
      return {
        stats: transformPitchingStats(raw, mlbId!, SEASON, mergedSavant, saber),
        savantLoaded: savant !== null,
      };
    },
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 10 * 60 * 1000,
  });

  return {
    stats: data?.stats ?? null,
    savantLoaded: data?.savantLoaded ?? false,
    isLoading,
    error: error as Error | null,
  };
}

// ─── Hitting stats (MLB Stats API + Savant overlay) ───────────────────

export function useHittingStats(mlbId: number | null): {
  stats: HittingStats | null;
  savantLoaded: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hittingStats', mlbId, SEASON],
    queryFn: async () => {
      const [raw, savant, saber, advanced, fg] = await Promise.all([
        fetchHittingStats(mlbId!, SEASON),
        fetchSavantBatterWithFallback(mlbId!, SEASON),
        fetchSabermetrics(mlbId!, SEASON),
        fetchAdvancedHitting(mlbId!, SEASON),
        fetchFanGraphsBatterById(mlbId!, SEASON).catch(() => null),
      ]);
      if (!raw) return { stats: null, savantLoaded: false };
      // Merge advanced MLB hitting into savant-shaped object if Savant failed
      const statcastSource = savant ?? (advanced ? {
        mlbId: mlbId!, name: '', year: SEASON, pa: 0,
        exitVelo:     advanced.exitVelocity ?? advanced.avgExitVelocity ?? 0,
        launchAngle:  advanced.launchAngle ?? 0,
        barrelPct:    advanced.barrelRate ?? advanced.barrelBattedRate ?? 0,
        hardHitPct:   advanced.hardHitRate ?? advanced.hardHitPercent ?? 0,
        sweetSpotPct: advanced.sweetSpotRate ?? 0,
        xwoba: 0, xba: 0,
        sprintSpeed:  advanced.sprintSpeed ?? 0,
        whiffPct: 0, chasePct: 0, contactPct: 0, woba: 0,
        gbPct: 0, fbPct: 0, ldPct: 0,
        pullPct: 0, straightPct: 0, oppoPct: 0,
      } : null);
      const stats = transformHittingStats(raw, mlbId!, SEASON, statcastSource, saber);
      // Overlay FanGraphs value stats (WPA / RE24 / Clutch / WAR)
      if (fg) {
        stats.wpa    = fg.wpa;
        stats.re24   = fg.re24;
        stats.clutch = fg.clutch;
        if (!stats.war && fg.war) stats.war = fg.war;
      }
      return {
        stats,
        savantLoaded: savant !== null || advanced !== null,
      };
    },
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 10 * 60 * 1000,
  });

  return {
    stats: data?.stats ?? null,
    savantLoaded: data?.savantLoaded ?? false,
    isLoading,
    error: error as Error | null,
  };
}

// ─── Game log ──────────────────────────────────────────────────────────

export function useGameLog(mlbId: number | null) {
  return useQuery({
    queryKey: ['gameLog2', mlbId, SEASON],   // bumped key to bust stale cache
    queryFn: () => fetchGameLog(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Savant-only batter Statcast ───────────────────────────────────────

export function useSavantBatter(mlbId: number | null) {
  return useQuery({
    queryKey: ['savantBatter', mlbId, SEASON],
    queryFn: () => fetchSavantBatterById(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,   // Savant leaderboards are heavy; cache 30 min
  });
}

export function useSavantPitcher(mlbId: number | null) {
  return useQuery({
    queryKey: ['savantPitcher', mlbId, SEASON],
    queryFn: () => fetchSavantPitcherById(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Pitch arsenal ─────────────────────────────────────────────────────

export type { RawMLBPitchArsenalEntry, PitcherGameLogEntry };

export function usePitchArsenal(mlbId: number | null) {
  return useQuery({
    queryKey: ['pitchArsenal', mlbId, SEASON],
    queryFn: () => fetchPitchArsenal(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 15 * 60 * 1000,
  });
}

export function usePitcherGameLog(mlbId: number | null) {
  return useQuery({
    queryKey: ['pitcherGameLog2', mlbId, SEASON],   // bumped key to bust stale cache
    queryFn: () => fetchPitcherGameLog(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Leaderboards ──────────────────────────────────────────────────────

export function useSavantBatterLeaderboard(minPA = 150) {
  return useQuery({
    queryKey: ['savantBatters', SEASON, minPA],
    queryFn: () => fetchSavantBatters(SEASON, minPA),
    staleTime: 60 * 60 * 1000,   // 1 hour
  });
}

export function useSavantPitcherLeaderboard(minPA = 150) {
  return useQuery({
    queryKey: ['savantPitchers', SEASON, minPA],
    queryFn: () => fetchSavantPitchers(SEASON, minPA),
    staleTime: 60 * 60 * 1000,
  });
}

// ─── Teams ─────────────────────────────────────────────────────────────

/** Raw MLB teams with numeric IDs — used by the Trade Analyzer for roster fetching */
export function useMLBRawTeams(): { teams: RawMLBTeam[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['mlbRawTeams'],
    queryFn: async () => {
      const raw = await fetchAllMLBTeams();
      return raw
        .filter(t => t.league?.id && t.division?.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
  return { teams: data ?? [], isLoading };
}

export type { RawMLBRosterPlayerHydrated };

/** 40-man roster for a team, hydrated with player age / position */
export function useTeamRoster(teamId: number | null, rosterType = '40Man') {
  return useQuery({
    queryKey: ['teamRoster', teamId, SEASON, rosterType],
    queryFn: () => fetchTeamRoster40Man(teamId!, SEASON, rosterType),
    enabled: teamId !== null && teamId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

/** Search players across all levels (MLB + minors) — for prospect lookup */
export function useProspectSearch(query: string) {
  return useQuery({
    queryKey: ['prospectSearch', query],
    queryFn: () => searchAllLevelsPlayers(query),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });
}

export type { RawMLBProspect };

/** MLB Pipeline team top-30 prospects for a given org — cached 24 h */
export function useMLBPipelineTeamProspects(orgId: number | null) {
  return useQuery({
    queryKey: ['mlbPipelineTeam', orgId, SEASON],
    queryFn: () => fetchMLBPipelineTeamProspects(orgId!, SEASON),
    enabled: orgId !== null && orgId > 0,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** MLB Pipeline national top-100 — cached 24 h */
export function useMLBPipelineTop100() {
  return useQuery({
    queryKey: ['mlbPipelineTop100', SEASON],
    queryFn: () => fetchMLBPipelineTop100(SEASON),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useMLBTeams(): { teams: Team[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['mlbTeams'],
    queryFn: async () => {
      const raw = await fetchAllMLBTeams();
      return raw
        .filter(t => t.league?.id && t.division?.id) // active MLB teams only
        .map(transformTeam);
    },
    staleTime: 24 * 60 * 60 * 1000,   // teams don't change daily
  });

  return { teams: data ?? [], isLoading };
}

// ─── Stat leaderboards (FanGraphs comprehensive batting + pitching) ───

export function useBattingLeaderboard() {
  return useQuery({
    queryKey: ['battingLeaderboard', SEASON],
    queryFn: () => fetchFanGraphsBattingLeaderboard(SEASON),
    staleTime: 60 * 60 * 1000,
  });
}

export function usePitchingLeaderboard() {
  return useQuery({
    queryKey: ['pitchingLeaderboard', SEASON],
    queryFn: () => fetchFanGraphsPitchingLeaderboard(SEASON),
    staleTime: 60 * 60 * 1000,
  });
}

/** Fetch a specific year's batting leaderboard — past seasons cached for 7 days */
export function useBattingLeaderboardByYear(year: number) {
  return useQuery({
    queryKey: ['battingLeaderboard', year],
    queryFn: () => fetchFanGraphsBattingLeaderboard(year),
    staleTime: year < CURRENT_YEAR ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
  });
}

/** Fetch a specific year's pitching leaderboard — past seasons cached for 7 days */
export function usePitchingLeaderboardByYear(year: number) {
  return useQuery({
    queryKey: ['pitchingLeaderboard', year],
    queryFn: () => fetchFanGraphsPitchingLeaderboard(year),
    staleTime: year < CURRENT_YEAR ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
  });
}

// ─── Defense stats (FanGraphs OAA/DRS/UZR for a single player) ────────

export function useDefenseStats(mlbId: number | null) {
  return useQuery({
    queryKey: ['defenseStats', mlbId, SEASON],
    queryFn: () => fetchFanGraphsFieldingById(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Team standings ────────────────────────────────────────────────────

export function useTeamStandings(season?: number) {
  const year = season ?? SEASON;
  return useQuery({
    queryKey: ['teamStandings', year],
    queryFn: () => fetchTeamStandings(year),
    staleTime: 15 * 60 * 1000,   // 15 min — standings update after games
  });
}

// ─── L/R splits ────────────────────────────────────────────────────────

export type { HittingSplitEntry, PitchingSplitEntry, HittingSplitsData, PitchingSplitsData };

export function useHittingSplits(mlbId: number | null) {
  return useQuery<HittingSplitsData>({
    queryKey: ['hittingSplits2', mlbId, SEASON],   // bumped key to bust stale cache
    queryFn: () => fetchHittingSplits(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

export function usePitchingSplits(mlbId: number | null) {
  return useQuery<PitchingSplitsData>({
    queryKey: ['pitchingSplits2', mlbId, SEASON],  // bumped key to bust stale cache
    queryFn: () => fetchPitchingSplits(mlbId!, SEASON),
    enabled: mlbId !== null && mlbId > 0,
    staleTime: 30 * 60 * 1000,
  });
}

// ─── Defense leaderboard (all fielders, current season) ───────────────

export function useDefenseLeaderboard() {
  return useQuery({
    queryKey: ['defenseLeaderboard', SEASON],
    queryFn: () => fetchFanGraphsFieldingLeaderboard(SEASON),
    staleTime: 60 * 60 * 1000,   // 1 hour — leaderboard is heavy
  });
}

// ─── Per-pitch-type spin rates (Savant custom leaderboard) ───────────────

/**
 * Returns a map of Statcast pitch code → average spin rate (rpm).
 * e.g. { FF: 2453, SL: 2314, CH: 1793, CU: 2517 }
 */
export function usePitchSpinStats(mlbId: number | null): Record<string, number> {
  const { data = {} } = useQuery({
    queryKey: ['pitchSpin', mlbId, SEASON],
    queryFn: () => fetchPitchSpinById(mlbId!, SEASON),
    enabled: !!mlbId,
    staleTime: 4 * 60 * 60 * 1000, // 4 hours — spin data changes rarely
  });
  return data;
}

// ─── Full player data (bio + both stat types) ─────────────────────────

export function useFullPlayerData(mlbId: number | null) {
  const { player, isLoading: playerLoading } = usePlayer(mlbId);
  const { stats: pitching, isLoading: pitchingLoading } = usePitchingStats(mlbId);
  const { stats: hitting, isLoading: hittingLoading } = useHittingStats(mlbId);

  return {
    player,
    pitching,
    hitting,
    isLoading: playerLoading || pitchingLoading || hittingLoading,
  };
}

// ─── Statcast spray chart (real batted-ball coordinates) ───────────────

export function useStatcastSprayChart(mlbId: number | null) {
  const YEAR = new Date().getFullYear();
  return useQuery({
    queryKey: ['statcastSpray', mlbId, YEAR],
    queryFn: () => fetchStatcastSprayChart(mlbId!, YEAR),
    enabled: !!mlbId,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false, // don't retry on CORS failure
  });
}

// ─── Real league percentile ranks ─────────────────────────────────────
//
// Merges Savant leaderboard ranks with FanGraphs-only stats (wRC+, ERA).
// All underlying leaderboards are already cached, so no extra network
// calls after the first load.

export interface HittingPercentileRanks {
  wrcPlus?:    number;
  exitVelo?:   number;
  barrelPct?:  number;
  hardHitPct?: number;
  bbPct?:      number;
  kPct?:       number;
}

export interface PitchingPercentileRanks {
  kPct?:      number;
  bbPct?:     number;
  era?:       number;
  xera?:      number;
  gbPct?:     number;
  velocity?:  number;
  whiffPct?:  number;
  chasePct?:  number;
}

export function useHittingPercentileRanks(mlbId: number | null) {
  const YEAR = new Date().getFullYear();
  return useQuery<HittingPercentileRanks>({
    queryKey: ['hittingPercentiles', mlbId, YEAR],
    queryFn: async () => {
      const [savantRes, wrcRes] = await Promise.allSettled([
        computeBatterSavantPercentiles(mlbId!, YEAR),
        computeWrcPlusPercentile(mlbId!, YEAR),
      ]);
      const s = savantRes.status === 'fulfilled' ? savantRes.value : null;
      const w = wrcRes.status === 'fulfilled' ? wrcRes.value : null;
      return {
        wrcPlus:    w    ?? undefined,
        exitVelo:   s?.exitVelo,
        barrelPct:  s?.barrelPct,
        hardHitPct: s?.hardHitPct,
        bbPct:      s?.bbPct,
        kPct:       s?.kPct,
      };
    },
    enabled: !!mlbId,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function usePitchingPercentileRanks(mlbId: number | null) {
  const YEAR = new Date().getFullYear();
  return useQuery<PitchingPercentileRanks>({
    queryKey: ['pitchingPercentiles', mlbId, YEAR],
    queryFn: async () => {
      const [savantRes, eraRes] = await Promise.allSettled([
        computePitcherSavantPercentiles(mlbId!, YEAR),
        computeERAPercentile(mlbId!, YEAR),
      ]);
      const s = savantRes.status === 'fulfilled' ? savantRes.value : null;
      const e = eraRes.status === 'fulfilled' ? eraRes.value : null;
      return {
        kPct:      s?.kPct,
        bbPct:     s?.bbPct,
        era:       e  ?? undefined,
        xera:      s?.xera,
        gbPct:     s?.gbPct,
        velocity:  s?.velocity,
        whiffPct:  s?.whiffPct,
        chasePct:  s?.chasePct,
      };
    },
    enabled: !!mlbId,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

// ─── Statcast hot/cold zone data (real wOBA per zone 1-9) ─────────────

export function useStatcastZoneData(mlbId: number | null) {
  const YEAR = new Date().getFullYear();
  return useQuery({
    queryKey: ['statcastZones', mlbId, YEAR],
    queryFn: () => fetchStatcastZoneData(mlbId!, YEAR),
    enabled: !!mlbId,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false, // don't retry on CORS failure
  });
}

// ─── Career year-by-year stats ─────────────────────────────────────────

export type { CareerHittingSeason, CareerPitchingSeason };

export function useCareerStats(mlbId: number | null) {
  const { data: hitting = [], isLoading: hitLoad } = useQuery({
    queryKey: ['careerHitting', mlbId],
    queryFn: () => fetchCareerHitting(mlbId!),
    enabled: !!mlbId,
    staleTime: 60 * 60 * 1000, // 1 hour — career data changes rarely
  });
  const { data: pitching = [], isLoading: pitLoad } = useQuery({
    queryKey: ['careerPitching', mlbId],
    queryFn: () => fetchCareerPitching(mlbId!),
    enabled: !!mlbId,
    staleTime: 60 * 60 * 1000,
  });
  return { hitting, pitching, isLoading: hitLoad || pitLoad };
}

// ─── Team schedule (recent + upcoming games) ──────────────────────────

export type { TeamScheduleGame, TeamSeasonStats };

export function useTeamSchedule(teamId: number | null) {
  const year = new Date().getFullYear();
  return useQuery<TeamScheduleGame[]>({
    queryKey: ['teamSchedule', teamId, year],
    queryFn:  () => fetchTeamRecentSchedule(teamId!, year),
    enabled:  !!teamId,
    staleTime: 5 * 60 * 1000,   // 5 min — live scores change
  });
}

export function useTeamSeasonStats(teamId: number | null) {
  const year = new Date().getFullYear();
  return useQuery<TeamSeasonStats>({
    queryKey: ['teamSeasonStats', teamId, year],
    queryFn:  () => fetchTeamSeasonStats(teamId!, year),
    enabled:  !!teamId,
    staleTime: 30 * 60 * 1000,  // 30 min — team totals change slowly
  });
}

