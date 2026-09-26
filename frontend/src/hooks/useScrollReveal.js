import { useScroll, useTransform } from 'framer-motion';

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

  return { textOpacity, textY, cardOpacity, cardScale };
}
