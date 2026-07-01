import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls the window (and any obvious scrollable containers) to the top
 * whenever the pathname changes. Mount once inside <BrowserRouter>.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Instant, not smooth — a smooth scroll on a route change feels laggy.
    try { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }
    catch { window.scrollTo(0, 0); }
    // Reset any inner scrollers that might have their own scroll state
    if (typeof document !== "undefined" && document.scrollingElement) {
      document.scrollingElement.scrollTop = 0;
    }
  }, [pathname]);
  return null;
}
