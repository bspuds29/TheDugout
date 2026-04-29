import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import ScrollToTop from './components/ui/ScrollToTop';

// ── Lazy-loaded pages (each becomes its own chunk) ──────────────────
const HomePage           = lazy(() => import('./pages/Home/HomePage'));
const PlayerPage         = lazy(() => import('./pages/Player/PlayerPage'));
const ClutchPage         = lazy(() => import('./pages/Clutch/ClutchPage'));
const DefensePage        = lazy(() => import('./pages/Defense/DefensePage'));
const LeaderboardPage    = lazy(() => import('./pages/Leaderboard/LeaderboardPage'));
const StandingsPage      = lazy(() => import('./pages/Standings/StandingsPage'));
const TeamStatsPage      = lazy(() => import('./pages/TeamStats/TeamStatsPage'));
const TradeAnalyzerPage  = lazy(() => import('./pages/TradeAnalyzer/TradeAnalyzerPage'));
const ToolsPage          = lazy(() => import('./pages/Tools/ToolsPage'));
const PlayerComparePage  = lazy(() => import('./pages/Tools/PlayerComparePage'));
const StatsHubPage       = lazy(() => import('./pages/Stats/StatsHubPage'));
const TeamPage           = lazy(() => import('./pages/Team/TeamPage'));

// ── Minimal inline spinner shown while a page chunk loads ───────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      color: 'var(--color-text-tertiary)',
      fontSize: 13,
      gap: 10,
      fontFamily: 'Inter, sans-serif',
    }}>
      <span style={{
        width: 16, height: 16,
        border: '2px solid var(--color-border)',
        borderTopColor: 'var(--color-accent)',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 0.6s linear infinite',
      }} />
      Loading…
    </div>
  );
}

// ─── Routes rendered inside BrowserRouter so useLocation() is valid ──
function AppRoutes() {
  // Keying <Routes> on pathname forces React Router to treat each navigation
  // as a fresh mount rather than an update. This defeats React 19 concurrent
  // rendering's "keep-previous-tree-while-suspending" optimization, which was
  // causing ToolsPage (and other heavy pages) to stay frozen on screen after
  // clicking a sidebar link. Suspense's stale-tree behaviour only applies to
  // updates — a fresh mount always shows the fallback spinner instead.
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"              element={<HomePage />} />
        <Route path="/player"        element={<PlayerPage />} />
        {/* Legacy routes — redirect to unified player page */}
        <Route path="/pitching"      element={<Navigate to="/player" replace />} />
        <Route path="/hitting"       element={<Navigate to="/player" replace />} />
        <Route path="/clutch"        element={<ClutchPage />} />
        <Route path="/defense"       element={<DefensePage />} />
        <Route path="/leaderboard"   element={<LeaderboardPage />} />
        <Route path="/standings"     element={<StandingsPage />} />
        <Route path="/team-stats"    element={<TeamStatsPage />} />
        <Route path="/trade"         element={<TradeAnalyzerPage />} />
        <Route path="/tools"         element={<ToolsPage />} />
        <Route path="/tools/compare" element={<PlayerComparePage />} />
        <Route path="/stats"         element={<StatsHubPage />} />
        <Route path="/team/:teamId"  element={<TeamPage />} />
        <Route path="*"              element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ScrollToTop />
        <Layout>
          <AppRoutes />
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: '16px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 64, lineHeight: 1 }}>⚾</div>
      <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text-primary)' }}>
        Foul Ball
      </h2>
      <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
        This page doesn't exist. Head back to the dugout.
      </p>
      <a href="/" style={{
        padding: '10px 22px', background: 'var(--color-accent)',
        color: 'white', borderRadius: 'var(--radius-lg)',
        fontSize: 14, fontWeight: 600, textDecoration: 'none'
      }}>
        Back to Dashboard
      </a>
    </div>
  );
}
