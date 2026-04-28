import React from 'react';
import './PercentileBar.css';
import { StatTooltip, STAT_GLOSSARY } from './StatTooltip';

interface PercentileBarProps {
  label: string;
  value: number; // 0–100
  raw?: string;
  color?: string;
  showValue?: boolean;
}

function getColor(value: number): string {
  if (value >= 90) return '#a855f7'; // Elite purple
  if (value >= 70) return '#20b2ff'; // Above avg blue
  if (value >= 50) return '#22c55e'; // Average green
  if (value >= 30) return '#f59e0b'; // Below avg amber
  return '#ef4444'; // Poor red
}

function getLabel(value: number): string {
  if (value >= 90) return 'Elite';
  if (value >= 70) return 'Above Avg';
  if (value >= 50) return 'Average';
  if (value >= 30) return 'Below Avg';
  return 'Poor';
}

export default function PercentileBar({
  label,
  value: rawValue,
  raw,
  showValue = true,
}: PercentileBarProps) {
  // Always clamp so bars can't overflow the track regardless of caller
  const value = Math.min(99, Math.max(1, rawValue));
  const color = getColor(value);
  const tier = getLabel(value);

  const hasGlossary = Boolean(STAT_GLOSSARY[label]);

  return (
    <div className="pbar">
      <div className="pbar-header">
        <span className="pbar-label">
          {hasGlossary ? (
            <StatTooltip stat={label} position="bottom">
              <span className="stat-tt-trigger">{label}</span>
            </StatTooltip>
          ) : label}
        </span>
        <div className="pbar-right">
          {raw && <span className="pbar-raw">{raw}</span>}
          {showValue && (
            <span className="pbar-pct" style={{ color }}>
              {Math.round(value)}
            </span>
          )}
        </div>
      </div>
      <div className="pbar-track">
        <div
          className="pbar-fill"
          style={{ width: `${value}%`, background: color }}
        />
        <div
          className="pbar-marker"
          style={{ left: `${value}%`, borderColor: color }}
        />
      </div>
      <div className="pbar-tier" style={{ color }}>{tier}</div>
    </div>
  );
}

interface PercentileGroupProps {
  items: Array<{ label: string; value: number; raw?: string }>;
}

export function PercentileGroup({ items }: PercentileGroupProps) {
  return (
    <div className="pbar-group">
      {items.map(item => (
        <PercentileBar key={item.label} {...item} />
      ))}
    </div>
  );
}
