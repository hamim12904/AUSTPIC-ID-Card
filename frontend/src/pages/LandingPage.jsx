import { useEffect, useRef, useState } from 'react';
import { getTemplate } from '../api/templateApi.js';
import { getNextMemberId } from '../api/memberApi.js';
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
  const fields = useCardStore((s) => s.fields);
  const setField = useCardStore((s) => s.setField);
  const syncWithUser = useCardStore((s) => s.syncWithUser);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    getTemplate().then(setTemplateConfig).catch(setLoadError);
  }, [setTemplateConfig]);

  // Bind the card to whoever is signed in and seed it from their registration
  // details. Runs on sign-up, sign-in, sign-out (null clears the card) and on
  // refresh, where the profile survives in localStorage but the card store does
  // not. Swapping accounts replaces the card instead of merging into it.
  useEffect(() => {
    syncWithUser(isAuthenticated ? user : null);
  }, [isAuthenticated, user, syncWithUser]);

  // Auto-fill the member ID once the user is signed in, so they never type
  // it themselves. Skips if a value is already sitting in the store. Keyed on
  // the account too: swapping users mid-flight would otherwise let the
  // previous account's id land on the new member's card.
  useEffect(() => {
    if (!isAuthenticated || fields.memberId) return undefined;
    let cancelled = false;
    getNextMemberId()
      .then((id) => {
        if (!cancelled) setField('memberId', id);
      })
      .catch((err) => console.warn('[memberId] could not fetch next id:', err?.message || err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, fields.memberId, setField]);

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
