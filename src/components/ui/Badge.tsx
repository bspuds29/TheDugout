import React from 'react';
import './Badge.css';

type BadgeVariant = 'default' | 'accent' | 'green' | 'red' | 'amber' | 'teal' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export default function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span className={`badge badge--${variant} badge--${size}`}>{children}</span>
  );
}
