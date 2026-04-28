/**
 * Unified API layer — mirrors the mock layer's export signature so pages
 * can switch between mock and live data by swapping a single import path.
 *
 * Usage in pages:
 *   import { searchPlayers, getHittingStats } from '../../data/api';
 *   // was: import { PLAYERS, getHittingStats } from '../../data/mock';
 */

export * from './mlbStats';
export * from './savant';
export * from './transformers';
