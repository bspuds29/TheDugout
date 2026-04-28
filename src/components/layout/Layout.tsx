import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="layout">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="layout-main">
        <TopBar onMenuToggle={() => setMobileOpen(true)} />
        {/*
          key={location.key} forces a full unmount + remount of the page content
          on every navigation. Without this, React 18 concurrent mode keeps the
          old (potentially long) page visible while the new one loads, leaving
          the user scrolled below the new page's content with nothing visible.
        */}
        <main className="layout-content" key={location.key}>
          {children}
        </main>
      </div>
    </div>
  );
}
