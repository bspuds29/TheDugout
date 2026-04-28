import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './StatCard.css';
import { StatTooltip, STAT_GLOSSARY } from './StatTooltip';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  accent?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'default' | 'accent' | 'green' | 'red' | 'amber' | 'teal' | 'purple';
  tooltip?: string;
}

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export default function StatCard({
  label,
  value,
  sub,
  trend,
  trendValue,
  accent,
  size = 'md',
  color = 'default',
  tooltip,
}: StatCardProps) {
  const TrendIcon = trend ? TREND_ICONS[trend] : null;
  const trendColor = trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'muted';

  const hasGlossary = Boolean(STAT_GLOSSARY[label]);

  return (
    <div
      className={`stat-card stat-card--${size} ${accent ? 'stat-card--accent' : ''}`}
      title={hasGlossary ? undefined : tooltip}
    >
      <div className="stat-card-label">
        {hasGlossary ? (
          <StatTooltip stat={label}>
            <span className="stat-tt-trigger">{label}</span>
          </StatTooltip>
        ) : label}
      </div>
      <div className={`stat-card-value stat-card-value--${color}`}>{value}</div>
      {(sub || trend) && (
        <div className="stat-card-footer">
          {sub && <span className="stat-card-sub">{sub}</span>}
          {trend && TrendIcon && (
            <span className={`stat-card-trend stat-card-trend--${trendColor}`}>
              <TrendIcon size={11} />
              {trendValue}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
