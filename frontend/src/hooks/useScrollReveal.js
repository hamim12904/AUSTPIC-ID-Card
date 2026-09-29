import { useScroll, useTransform, useMotionTemplate } from 'framer-motion';

export function useScrollReveal(heroRef, stageRef) {
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const { scrollYProgress: cardProgress } = useScroll({
    target: stageRef || heroRef,
    offset: stageRef ? ['start 100%', 'start 36%'] : ['start start', 'end start'],
  });

  const textOpacity = useTransform(heroProgress, [0, 0.4], [1, 0]);
  const textY = useTransform(heroProgress, [0, 0.4], [0, -80]);
  const cardOpacity = useTransform(cardProgress, [0, 0.18, 0.42], [0, 0.8, 1]);
  const cardScale = useTransform(cardProgress, [0, 0.82], [0.72, 1]);

  // Background glow behind the Hero: rather than just scaling a fixed
  // gradient (barely visible), the gradient's own center and size are
  // driven by scroll — it starts as a tight highlight near the top and
  // grows/drifts down the section as you scroll, then fades out right
  // before the next section takes over. This is what actually reads as
  // "movement" the way the reference clip's spotlight does.
  const glowCenterY = useTransform(heroProgress, [0, 1], [0, 65]); // % down the section
  const glowSize = useTransform(heroProgress, [0, 1], [45, 100]); // % width/height of the blob
  const glowOpacity = useTransform(heroProgress, [0, 0.7, 1], [1, 0.85, 0]);
  const glowBackground = useMotionTemplate`radial-gradient(${glowSize}% ${glowSize}% at 50% ${glowCenterY}%, rgba(123,196,189,0.4) 0%, rgba(243,246,245,0) 70%)`;

  return {
    textOpacity,
    textY,
    cardOpacity,
    cardScale,
    glowBackground,
    glowOpacity,
  };
}