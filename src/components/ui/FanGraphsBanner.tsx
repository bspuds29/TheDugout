import React from 'react';
import { useFanGraphsStatus } from '../../hooks/useFanGraphsStatus';

/**
 * Renders a subtle inline notice when FanGraphs cannot be reached (CORS block
 * in production).  Shows nothing while status is unknown or when FG is reachable.
 *
 * Drop this anywhere a page relies on FanGraphs data:
 *   <FanGraphsBanner />
 */
export default function FanGraphsBanner() {
  const status = useFanGraphsStatus();
  if (status !== 'blocked') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        marginBottom: 12,
        borderRadius: 8,
        background: 'var(--color-bg-elevated, #1a2535)',
        border: '1px solid var(--color-border, #1e2d3d)',
        fontSize: 12,
        color: 'var(--color-text-tertiary, #4d6070)',
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
      <span>
        <strong style={{ color: 'var(--color-text-secondary, #8ba3b8)', fontWeight: 600 }}>
          FanGraphs stats unavailable.&nbsp;
        </strong>
        Advanced metrics (wRC+, FIP, OAA, UZR) require FanGraphs, which may be
        blocked by CORS in this environment. Core MLB stats are still shown.
      </span>
    </div>
  );
}
