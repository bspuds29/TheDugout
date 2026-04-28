/**
 * PlayerHeadshot
 *
 * Renders an MLB player headshot from the MLB CDN (Cloudinary).
 * The URL includes a built-in generic silhouette fallback so the image
 * never 404s — if a player has no photo on record they get the grey
 * outline silhouette automatically.
 *
 * Usage:
 *   <PlayerHeadshot mlbId={660271} size={48} />
 */

import React from 'react';

interface PlayerHeadshotProps {
  mlbId:     number;
  size?:     number;
  className?: string;
  style?:    React.CSSProperties;
  alt?:      string;
}

/**
 * Build the MLB CDN Cloudinary URL using the "silo" headshot type.
 * Silo images have the player cut out on a transparent background — no
 * grey/white backdrop — so they look clean inside any coloured container.
 * The `d_people:generic:headshot:silo:current.png` param is the CDN's
 * built-in fallback silhouette for players without a photo on file.
 */
function headshotUrl(mlbId: number, width: number): string {
  return (
    `https://img.mlbstatic.com/mlb-photos/image/upload/` +
    `d_people:generic:headshot:silo:current.png/` +
    `w_${width},q_auto:best/` +
    `v1/people/${mlbId}/headshot/silo/current`
  );
}

export default function PlayerHeadshot({
  mlbId,
  size = 48,
  className,
  style,
  alt = '',
}: PlayerHeadshotProps) {
  // Request 2× the display size for retina screens (capped at 213 — CDN max)
  const fetchWidth = Math.min(size * 2, 213);

  return (
    <img
      src={headshotUrl(mlbId, fetchWidth)}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{
        objectFit:      'cover',
        objectPosition: '50% 12%',
        display:        'block',
        flexShrink:     0,
        ...style,
      }}
    />
  );
}
