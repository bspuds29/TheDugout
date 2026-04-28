import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, Shield, ArrowLeftRight,
  Wrench, ChevronRight, Zap, Users, Menu, X, BarChart2,
  Trophy, Building2,
} from 'lucide-react';
import './Sidebar.css';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={16} /> },
    ],
  },
  {
    group: 'Player Analytics',
    items: [
      { label: 'Player Stats',  path: '/player',      icon: <TrendingUp size={16} /> },
      { label: 'Leaderboard',  path: '/leaderboard', icon: <BarChart2 size={16} /> },
      { label: 'Defense',      path: '/defense',     icon: <Shield size={16} /> },
      { label: 'Clutch Analytics', path: '/clutch', icon: <Zap size={16} />, badge: 'HOT' },
    ],
  },
  {
    group: 'Teams',
    items: [
      { label: 'Standings',    path: '/standings',    icon: <Trophy    size={16} /> },
      { label: 'Team Stats',   path: '/team-stats',  icon: <Building2 size={16} /> },
    ],
  },
  {
    group: 'Tools',
    items: [
      { label: 'Trade Analyzer', path: '/trade', icon: <ArrowLeftRight size={16} />, badge: 'NEW' },
      { label: 'Player Compare', path: '/tools/compare', icon: <Users size={16} /> },
      { label: 'Advanced Tools', path: '/tools', icon: <Wrench size={16} /> },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <NavLink to="/" className="sidebar-logo-link" onClick={onMobileClose}>
            <div className="sidebar-logo-icon">
              <img src="/logo.png" alt="The Dugout" className="sidebar-logo-img" />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-name">The Dugout</span>
              <span className="sidebar-logo-sub">Analytics Platform</span>
            </div>
          </NavLink>
          <button className="sidebar-mobile-close" onClick={onMobileClose}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.group} className="sidebar-group">
              <span className="sidebar-group-label">{group.group}</span>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/' || item.path === '/tools'}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                  }
                  onClick={onMobileClose}
                >
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span className="sidebar-link-label">{item.label}</span>
                  {item.badge && (
                    <span className={`sidebar-badge sidebar-badge--${item.badge.toLowerCase()}`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={12} className="sidebar-link-arrow" />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-season">
            <span className="sidebar-season-dot" />
            <span>{new Date().getFullYear()} Season • Live</span>
          </div>
          <a
            href="https://x.com/TheDugoutMLB"
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-x-link"
            title="Follow @TheDugoutMLB on X"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @TheDugoutMLB
          </a>
        </div>
      </aside>
    </>
  );
}
