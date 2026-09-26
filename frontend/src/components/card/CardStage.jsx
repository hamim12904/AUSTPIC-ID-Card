import { useRef } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal.js';
import IDCardShell from './IDCardShell.jsx';

export default function CardStage({ heroRef, template, onGenerate }) {
  const stageRef = useRef(null);
  const { cardOpacity, cardScale } = useScrollReveal(heroRef, stageRef);

  return (
    <section
      id="card-stage"
      ref={stageRef}
      className="relative flex min-h-[125vh] items-start justify-center overflow-hidden px-4 pb-24 pt-12"
    >
      <div className="w-full max-w-[760px] flex justify-center">
        <IDCardShell
          template={template}
          onGenerate={onGenerate}
          scale={cardScale}
          opacity={cardOpacity}
        />
      </div>
    </section>
  );
}
