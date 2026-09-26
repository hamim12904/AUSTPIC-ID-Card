import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import CardInteractionCursor from './components/ui/CardInteractionCursor.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';

/**
 * Sends the window back to the top on every route change.
 *
 * React Router v6 does not touch the scroll position, and the browser's own
 * same-document restoration then puts you back where you were — so signing in
 * from /login dropped you halfway down the landing page, at the card editor,
 * instead of at the top. Restoration is switched off so the two don't fight:
 * the browser restoring a stale offset would otherwise win over this.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    // 'instant' overrides html { scroll-behavior: smooth } (index.css), which
    // would otherwise animate the jump on every navigation.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      {/* Mounted once here (not per-page) since body has `cursor: none`
          globally — without this, /login and /signup would have an
          invisible cursor. */}
      <CardInteractionCursor />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </>
  );
}
