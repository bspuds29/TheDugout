import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls the window to the top whenever the route pathname changes.
 * React Router v6 does not reset scroll position on navigation, so without
 * this component navigating from a long page (e.g. Lineup Optimizer) to a
 * shorter one leaves the user scrolled past the new page's content.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Direct property assignment bypasses CSS scroll-behavior: smooth
    // which can otherwise animate (and thus delay) the reset.
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0; // Safari fallback
  }, [pathname]);

  return null;
}
