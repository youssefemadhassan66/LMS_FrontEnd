import React, { useEffect, useRef, useState } from 'react';
import { usePageRevealed } from '../Loading/PageStage';

const DURATION_MS = 650;
const easeOutQuart = (t) => 1 - (1 - t) ** 4;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts a whole number up from zero once the page is on screen.
 *
 * Anything that is not a finite number (a dash placeholder, "N/A", a
 * percentage string) is rendered as-is. Screen readers get the final value
 * straight away; only the visible digits animate. It counts once: a later
 * refresh of the same card shows the new value directly.
 */
const CountUp = ({ value, suffix = '' }) => {
  const revealed = usePageRevealed();
  const target = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const [shown, setShown] = useState(0);
  const played = useRef(false);

  useEffect(() => {
    if (target === null || !revealed) return undefined;

    if (played.current || prefersReducedMotion() || target === 0) {
      played.current = true;
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }

    played.current = true;
    let frame;
    // Timed from the first frame's own timestamp. A frame timestamp can come
    // from a different clock than performance.now(), or land slightly before
    // it, and a negative progress would show a negative number for a frame.
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const progress = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      setShown(Math.round(target * easeOutQuart(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, revealed]);

  if (target === null) return <>{value}</>;

  return (
    <>
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {target}
        {suffix}
      </span>
    </>
  );
};

export default CountUp;
