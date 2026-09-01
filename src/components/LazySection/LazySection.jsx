import React, { Suspense, useEffect, useRef, useState } from 'react';

const supportsIntersectionObserver = () => typeof IntersectionObserver !== 'undefined';

/**
 * Defers a section of real page content until it is about to scroll into view,
 * then mounts it from a lazy import.
 *
 * DeferredVisual does the same job for decorative WebGL backdrops, but it marks
 * its holder aria-hidden and renders nothing while it waits — right for a
 * flourish, wrong for content a reader is meant to reach. This one keeps the
 * subtree in the accessibility tree and holds its height with a placeholder, so
 * the page below it does not jump when the real thing arrives.
 *
 * Props:
 *   minHeight  — height the placeholder reserves (default 32rem)
 *   rootMargin — how early to mount, relative to the viewport
 *   fallback   — node shown while the chunk is in flight
 */
const LazySection = ({
  children,
  minHeight = '32rem',
  rootMargin = '300px',
  fallback = null,
  className,
  ...rest
}) => {
  const holderRef = useRef(null);
  // Without IntersectionObserver there is no way to defer, so mount right away
  // rather than leaving a reader with a permanently empty box.
  const [active, setActive] = useState(() => !supportsIntersectionObserver());

  useEffect(() => {
    if (active || !supportsIntersectionObserver()) return undefined;

    const holder = holderRef.current;
    if (!holder) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(holder);
    return () => observer.disconnect();
  }, [active, rootMargin]);

  return (
    <div
      ref={holderRef}
      className={className}
      style={active ? undefined : { minHeight }}
      {...rest}
    >
      {active ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
};

export default LazySection;
