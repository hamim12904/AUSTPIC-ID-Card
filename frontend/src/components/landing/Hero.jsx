import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useScrollReveal } from '../../hooks/useScrollReveal.js';
import { useSmoothScroll } from '../../hooks/useSmoothScroll.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import AnimatedButton from '../ui/AnimatedButton.jsx';

// Two-layer left-to-right wipe, matching the reference clip: a pale, blurred
// "ghost" copy of the line sweeps in first, then the real ink-coloured copy
// wipes in right behind it and covers the ghost. `delay` staggers separate
// lines against each other; the ~0.18s gap between the ghost and main layers
// is what gives each individual line its two-step reveal.
const wipeEase = [0.22, 0.8, 0.32, 1];

function WipeText({ children, delay = 0, className = '' }) {
  return (
    <span className={`relative inline-block ${className}`}>
      {/* Real, accessible text — kept in normal flow (via visibility, not
          display) so it still sizes the box and is readable to screen
          readers; the two layers below are decorative copies on top of it. */}
      <span className="invisible">{children}</span>

      <motion.span
        aria-hidden
        className="absolute inset-0 text-[#f3f6f5]"
        style={{ filter: 'blur(6px)' }}
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: 0.5, ease: wipeEase, delay }}
      >
        {children}
      </motion.span>

      <motion.span
        aria-hidden
        className="absolute inset-0"
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        animate={{ clipPath: 'inset(0 0% 0 0)' }}
        transition={{ duration: 0.5, ease: wipeEase, delay: delay + 0.18 }}
      >
        {children}
      </motion.span>
    </span>
  );
}

// Simple staggered blur-fade for the copy below the headline (buttons,
// helper text) — the wipe above is reserved for the two title lines, same as
// the reference clip only wipes its headline and fades the rest in behind it.
const lineGroup = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0.85 },
  },
};

const line = {
  hidden: { opacity: 0, y: 10, filter: 'blur(10px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

const Hero = forwardRef(function Hero(_, ref) {
  const { textOpacity, textY, glowBackground, glowOpacity } = useScrollReveal(ref);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // The card stage is rendered further down this same page, so scrolling beats
  // routing — it keeps the Hero as the single scrolling surface instead of
  // pushing the card onto a separate route. Eased over 1.5s so the scroll-linked
  // card reveal is actually visible on the way down.
  const scrollToCard = useSmoothScroll();

  const headline = isAuthenticated ? `Hello, ${user?.name || 'there'}` : 'Make your ID card';

  return (
    <section
      ref={ref}
      className="relative overflow-hidden h-[90vh] flex flex-col items-center justify-center px-6"
    >
      {/* Moving background glow — teal radial highlight behind the copy that
          grows and drifts down as the Hero scrolls past, then fades into the
          card section below. Same colour as the button glow (#7bc4bd) so it
          reads as part of the same system rather than a new accent. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: glowBackground,
          opacity: glowOpacity,
        }}
      />

      <motion.div
        style={{ opacity: textOpacity, y: textY }}
        className={`text-center ${isAuthenticated ? 'max-w-3xl' : 'max-w-md'}`}
      >
        <p className="font-body text-teal text-sm mb-4">
          <WipeText delay={0.05}>AUST Programming &amp; Informatics Club</WipeText>
        </p>

        {/* The greeting carries a variable-length name, so it gets a wider box.
            whitespace-nowrap keeps it on one line; html has overflow-x: clip,
            so a long name is clipped rather than opening a horizontal
            scrollbar. */}
        <h1
          className={`font-body font-bold text-4xl sm:text-5xl text-ink leading-tight tracking-tight ${
            isAuthenticated ? 'whitespace-nowrap' : ''
          }`}
        >
          <WipeText delay={0.32}>{headline}</WipeText>
        </h1>

        <motion.div variants={lineGroup} initial="hidden" animate="show">
          <motion.div
            variants={line}
            className="mt-7 flex flex-wrap items-center justify-center gap-4"
          >
            {isAuthenticated ? (
              <>
                <AnimatedButton onClick={() => scrollToCard('#card-stage')}>Make your ID</AnimatedButton>
                <AnimatedButton
                  className="glow-btn--ghost"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </AnimatedButton>
              </>
            ) : (
              <>
                <AnimatedButton to="/login">Login</AnimatedButton>
                <AnimatedButton to="/signup">Sign Up</AnimatedButton>
              </>
            )}
          </motion.div>

          <motion.p variants={line} className="font-body text-ink/60 mt-6">
            {isAuthenticated
              ? 'Scroll down and fill the card directly as it grows into view.'
              : 'Sign in or create an account to start your ID card.'}
          </motion.p>
        </motion.div>

        {isAuthenticated && (
          <motion.div
            className="mt-10 text-ink/40 text-2xl"
            initial={{ opacity: 0 }}
            animate={{ y: [0, 8, 0], opacity: 1 }}
            transition={{
              y: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
              opacity: { duration: 0.5, delay: 1.1 },
            }}
          >
            ↓
          </motion.div>
        )}
      </motion.div>
    </section>
  );
});

export default Hero;