import React, { useState } from 'react';
import './PlayerAvatar.css';

interface PlayerAvatarProps {
  /** MLB player ID — drives the official headshot URL */
  mlbId?: number | null;
  name: string;
  /** Pixel size (width = height). Default 72. */
  size?: number;
  className?: string;
}

/**
 * MLB Photos Cloudinary CDN — includes a built-in generic silhouette fallback
 * via the `d_people:generic:headshot:67:current.png` Cloudinary default parameter,
 * so this URL always resolves even for players without an official headshot.
 */
const headshotUrl = (mlbId: number) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${mlbId}/headshot/67/current`;

// Generic baseball-player silhouette used for demo/mock players
function Silhouette() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="player-avatar-silhouette">
      {/* helmet */}
      <ellipse cx="40" cy="22" rx="14" ry="13" fill="currentColor" opacity="0.55" />
      <path d="M27 26 Q26 36 30 38 L50 38 Q54 36 53 26" fill="currentColor" opacity="0.55" />
      {/* brim */}
      <path d="M26 30 Q18 31 19 36 L30 36" fill="currentColor" opacity="0.45" />
      {/* face */}
      <ellipse cx="40" cy="35" rx="10" ry="11" fill="currentColor" opacity="0.35" />
      {/* shoulders / jersey */}
      <path
        d="M20 58 Q22 46 32 44 L40 46 L48 44 Q58 46 60 58 Q55 65 40 66 Q25 65 20 58Z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  );
}

export default function PlayerAvatar({
  mlbId,
  name,
  size = 72,
  className = '',
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(' ')
    .map(n => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const showPhoto = !!mlbId && !imgError;

  return (
    <div
      className={`player-avatar ${showPhoto ? 'player-avatar--photo' : 'player-avatar--fallback'} ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={headshotUrl(mlbId!)}
          alt={name}
          className="player-avatar-img"
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : mlbId ? (
        // Had an mlbId but image failed — show initials
        <span className="player-avatar-initials">{initials}</span>
      ) : (
        // Demo/mock player — generic silhouette
        <Silhouette />
      )}
    </div>
  );
}
