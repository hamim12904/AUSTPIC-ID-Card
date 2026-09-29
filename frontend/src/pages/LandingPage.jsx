import { useEffect, useRef, useState } from 'react';
import { getTemplate } from '../api/templateApi.js';
import { getNextMemberId } from '../api/memberApi.js';
import { fetchMe } from '../api/authApi.js';
import { useCardStore } from '../store/useCardStore.js';
import { useAuthStore } from '../store/useAuthStore.js';
import Hero from '../components/landing/Hero.jsx';
import CardStage from '../components/card/CardStage.jsx';
import ReviewExport from '../components/review/ReviewExport.jsx';

// Single scrolling page: Hero on top, card editor below. The card is behind
// auth — signed-out visitors get the Hero's Login / Sign Up and nothing under
// it. The Hero's scroll arrow points at the card once signed in.
export default function LandingPage() {
  const heroRef = useRef(null);
  const [loadError, setLoadError] = useState(null);

  const templateConfig = useCardStore((s) => s.templateConfig);
  const setTemplateConfig = useCardStore((s) => s.setTemplateConfig);
  const status = useCardStore((s) => s.status);
  const setStatus = useCardStore((s) => s.setStatus);
  const setField = useCardStore((s) => s.setField);
  const syncWithUser = useCardStore((s) => s.syncWithUser);
  const memberIdRetry = useCardStore((s) => s.memberIdRetry);
  const setMemberIdStatus = useCardStore((s) => s.setMemberIdStatus);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  useEffect(() => {
    getTemplate().then(setTemplateConfig).catch(setLoadError);
  }, [setTemplateConfig]);

  // Re-read the profile from the database once per page load. The copy in
  // localStorage can predate fields the server fills in itself — memberId
  // above all — and without this the card would sit on "Assigning…" waiting on
  // a fallback request for a value the user document already holds. The token
  // stays as-is, so this never signs anyone out.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (!cancelled) refreshUser(user);
      })
      .catch((err) => {
        // A dead backend here is not fatal: the card still works off the
        // cached profile, and the memberId fallback below covers the gap.
        console.warn('[auth] could not refresh profile:', err?.message || err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, refreshUser]);

  // Bind the card to whoever is signed in and seed it from their registration
  // details. Runs on sign-up, sign-in, sign-out (null clears the card) and on
  // refresh, where the profile survives in localStorage but the card store does
  // not. Swapping accounts replaces the card instead of merging into it.
  useEffect(() => {
    syncWithUser(isAuthenticated ? user : null);
  }, [isAuthenticated, user, syncWithUser]);

  // Fallback allocation. Signup and login hand back a memberId on the user
  // document, and the effect above has already seeded it into the card, so this
  // normally returns without a request. It only does real work for a profile
  // cached in localStorage from before that was true, and it is safe to repeat:
  // the backend never renumbers an account that already has an id.
  //
  // Reads the store directly rather than the `fields` in this render's closure,
  // because syncWithUser above writes synchronously in an earlier effect — the
  // closure is still the pre-seed value, which would fire a needless request on
  // every page load.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    if (user?.memberId || useCardStore.getState().fields.memberId) return undefined;

    let cancelled = false;
    setMemberIdStatus('loading');
    getNextMemberId()
      .then((id) => {
        if (cancelled) return;
        setField('memberId', id);
        setMemberIdStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[memberId] could not fetch next id:', err?.message || err);
        setMemberIdStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // memberIdStatus is deliberately absent: writing it here would re-enter
    // this effect and fire a second request. memberIdRetry is the explicit,
    // user-driven way back in after a failure.
  }, [isAuthenticated, user?.id, user?.memberId, memberIdRetry, setField, setMemberIdStatus]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <p className="font-body text-ink/60">
          Couldn't load the card template. Refresh to try again.
        </p>
      </div>
    );
  }

  if (!templateConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-ink/10 border-t-teal-light animate-spin" />
      </div>
    );
  }

  return (
    <main>
      <Hero ref={heroRef} />
      {/* The card editor is behind auth. Signed-out visitors get the Hero's
          Login / Sign Up and nothing below it; once signed in the Hero swaps
          those for a greeting and a scroll arrow down to the card. */}
      {isAuthenticated && (
        <>
          <CardStage
            heroRef={heroRef}
            template={templateConfig}
            onGenerate={() => setStatus('submitting')}
          />
          {status !== 'idle' && <ReviewExport />}
        </>
      )}
    </main>
  );
}
