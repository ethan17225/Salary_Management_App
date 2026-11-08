'use client';

import { useEffect, useRef } from 'react';
import { fmt } from '@/lib/utils';

export function HeroTotalCounter({ totalCents }: { totalCents: number }) {
  const bigTotalRef = useRef<HTMLParagraphElement | null>(null);
  const countedRef = useRef(false);

  useEffect(() => {
    const el = bigTotalRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (countedRef.current || reduced) {
      el.textContent = fmt(totalCents);
      return;
    }
    countedRef.current = true;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      el.textContent = fmt(Math.round(totalCents * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [totalCents]);

  return (
    <p className="big" ref={bigTotalRef}>
      {fmt(totalCents)}
    </p>
  );
}

