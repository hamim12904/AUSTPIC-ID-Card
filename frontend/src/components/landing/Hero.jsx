import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useScrollReveal } from '../../hooks/useScrollReveal.js';
import { useSmoothScroll } from '../../hooks/useSmoothScroll.js';
import { useAuthStore } from '../../store/useAuthStore.js';
import AnimatedButton from '../ui/AnimatedButton.jsx';

const Hero = forwardRef(function Hero(_, ref) {
  const { textOpacity, textY } = useScrollReveal(ref);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // The card stage is rendered further down this same page, so scrolling beats
  // routing — it keeps the Hero as the single scrolling surface instead of
  // pushing the card onto a separate route. Eased over 1.5s so the scroll-linked
  // card reveal is actually visible on the way down.
  const scrollToCard = useSmoothScroll();

  return (
    <section ref={ref} className="h-[90vh] flex flex-col items-center justify-center px-6">
      <motion.div
        style={{ opacity: textOpacity, y: textY }}
        className={`text-center ${isAuthenticated ? 'max-w-3xl' : 'max-w-md'}`}
      >
        <p className="font-body text-teal text-sm mb-4">AUST Programming &amp; Informatics Club</p>
        {/* The greeting carries a variable-length name, so it gets a wider box.
            whitespace-nowrap keeps it on one line; html has overflow-x: clip,
            so a long name is clipped rather than opening a horizontal
            scrollbar. */}
        <h1
          className={`font-body font-bold text-4xl sm:text-5xl text-ink leading-tight tracking-tight ${
            isAuthenticated ? 'whitespace-nowrap' : ''
          }`}
        >
          {isAuthenticated ? `Hello, ${user?.name || 'there'}` : 'Make your ID card'}
        </h1>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
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
        </div>

        <p className="font-body text-ink/60 mt-6">
          {isAuthenticated
            ? 'Scroll down and fill the card directly as it grows into view.'
            : 'Sign in or create an account to start your ID card.'}
        </p>

        {isAuthenticated && (
          <motion.div
            className="mt-10 text-ink/40 text-2xl"
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            ↓
          </motion.div>
        )}
      </motion.div>
    </section>
  );
});

export default Hero;
