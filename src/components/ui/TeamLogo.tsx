/**
 * TeamLogo — renders an MLB team's official SVG logo from the MLB static CDN.
 * Accepts either an MLB Stats API team ID or a team abbreviation string.
 * Falls back silently (hides the img element) if the logo fails to load.
 */

import React from 'react';

// Maps every known abbreviation (including FanGraphs variants) → MLB Stats API team ID
export const ABBR_TO_MLB_ID: Record<string, number> = {
  // Standard MLB abbreviations
  LAA: 108, ARI: 109, BAL: 110, BOS: 111, CHC: 112,
  CIN: 113, CLE: 114, COL: 115, DET: 116, HOU: 117,
  KC:  118, LAD: 119, WSH: 120, NYM: 121,
  PIT: 134, SD:  135, SEA: 136, SF:  137, STL: 138,
  TB:  139, TEX: 140, TOR: 141, MIN: 142, PHI: 143,
  ATL: 144, CWS: 145, MIA: 146, NYY: 147, MIL: 158,
  // Athletics (Sacramento / Oakland variants)
  ATH: 133, OAK: 133,
  // FanGraphs-specific abbreviation variants
  CHW: 145,   // White Sox
  KCR: 118,   // Royals
  SDP: 135,   // Padres
  SFG: 137,   // Giants
  TBR: 139,   // Rays
  WSN: 120,   // Nationals
};

interface TeamLogoProps {
  /** Team abbreviation string (e.g. "NYY", "LAD", "CHW") */
  abbr?: string;
  /** MLB Stats API team ID — use this when abbr is unavailable */
  teamId?: number;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TeamLogo({ abbr, teamId, size = 28, className, style }: TeamLogoProps) {
  const id = teamId ?? (abbr ? ABBR_TO_MLB_ID[abbr.toUpperCase()] : undefined);
  if (!id) return null;

  return (
    <img
      src={`https://www.mlbstatic.com/team-logos/${id}.svg`}
      alt={abbr ?? String(id)}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', flexShrink: 0, display: 'block', ...style }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
