import React from 'react';
import './Card.css';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  noPad?: boolean;
  accent?: boolean;
  glow?: boolean;
}

export default function Card({
  children,
  title,
  subtitle,
  action,
  className = '',
  noPad = false,
  accent = false,
  glow = false,
}: CardProps) {
  return (
    <div className={`card ${accent ? 'card--accent' : ''} ${glow ? 'card--glow' : ''} ${className}`}>
      {(title || action) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className={noPad ? '' : 'card-body'}>
        {children}
      </div>
    </div>
  );
}
