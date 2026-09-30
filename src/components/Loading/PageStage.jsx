import React, { Suspense, createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PageLoader from './PageLoader';
import { pendingBetween, requestClock, subscribeRequests } from '../../utils/requestTracker';
import './PageLoader.css';

// Timings, in milliseconds.
// A page that is ready within SHOW_DELAY never sees the loader: below ~300ms a
// loader reads as flicker, and holding it for MIN_VISIBLE would make a fast
// page slower. Measured locally, a warm page mounts ~150ms after the click and
// its data is in by ~270ms.
const SHOW_DELAY = 280;     // pages that settle faster than this never show the loader
const MIN_VISIBLE = 300;    // once shown, long enough to read rather than flash
const QUIET = 100;          // no requests for this long counts as settled (covers chained requests)
const REQUEST_WINDOW = 1500; // later requests (polling, sockets) are not the page load
const MAX_WAIT = 8000;      // a slow endpoint must never hide the page for good

const StageContext = createContext(null);

// Suspense fallback. Renders nothing itself (the stage draws the loader), but
// tells the stage the page's code is still downloading.
const ChunkPending = () => {
  const stage = useContext(StageContext);
  useLayoutEffect(() => stage?.chunkPending(), [stage]);
  return null;
};

/**
 * Hosts the routed dashboard page and shows one loading screen from the moment
 * a sidebar link is clicked until the new page's code and first data are in.
 *
 * - The Suspense boundary is keyed by path, so a click commits at once: the
 *   sidebar highlight moves and the old page goes away, instead of the old page
 *   lingering with no feedback while the new chunk downloads.
 * - The page mounts hidden and inert and is revealed once the requests it
 *   started have finished, so it never flashes its empty state ("0 total")
 *   before its data arrives.
 */
const PageStage = ({ pathname, label, children }) => {
  const [readyPath, setReadyPath] = useState(null);
  const [loaderPath, setLoaderPath] = useState(null);
  const suspended = useRef(0);
  const recheck = useRef(() => {});

  const stage = useMemo(
    () => ({
      chunkPending: () => {
        suspended.current += 1;
        recheck.current();
        return () => {
          suspended.current -= 1;
          recheck.current();
        };
      },
    }),
    [],
  );

  useLayoutEffect(() => {
    const startedAt = requestClock();
    let shownAt = null;
    let lastBusyAt = startedAt;
    let finished = false;
    let settleTimer = null;

    const busy = () =>
      suspended.current > 0 || pendingBetween(startedAt - 50, startedAt + REQUEST_WINDOW) > 0;

    const stop = () => {
      finished = true;
      clearTimeout(showTimer);
      clearTimeout(maxTimer);
      clearTimeout(settleTimer);
      unsubscribe();
    };

    const reveal = () => {
      if (finished) return;
      stop();
      setReadyPath(pathname);
    };

    // Only a page that is genuinely still loading gets the loader. One that is
    // merely sitting out its quiet period is about to appear, and putting the
    // loader up then would cost it MIN_VISIBLE for nothing.
    const showLoader = () => {
      if (finished || shownAt !== null || !busy()) return;
      shownAt = requestClock();
      setLoaderPath(pathname);
    };

    const check = () => {
      if (finished) return;
      clearTimeout(settleTimer);
      const now = requestClock();
      if (busy()) {
        lastBusyAt = now;
        if (now - startedAt >= SHOW_DELAY) showLoader();
        return;
      }
      const quietLeft = QUIET - (now - lastBusyAt);
      const visibleLeft = shownAt === null ? 0 : MIN_VISIBLE - (now - shownAt);
      settleTimer = setTimeout(() => {
        if (busy()) return check();
        // The loader may have appeared while we waited for quiet.
        if (shownAt !== null && requestClock() - shownAt < MIN_VISIBLE) return check();
        reveal();
      }, Math.max(quietLeft, visibleLeft, 0));
    };

    const showTimer = setTimeout(showLoader, SHOW_DELAY);
    const maxTimer = setTimeout(reveal, MAX_WAIT);
    const unsubscribe = subscribeRequests(check);

    recheck.current = check;
    check();

    return () => {
      recheck.current = () => {};
      if (!finished) stop();
    };
  }, [pathname]);

  const pending = readyPath !== pathname;
  const showLoader = pending && loaderPath === pathname;

  return (
    <div className={`page-stage${pending ? ' is-pending' : ''}`}>
      {showLoader && (
        <div className="page-stage__overlay">
          <PageLoader label={label} />
        </div>
      )}
      <div className="page-stage__content" inert={pending || undefined}>
        <StageContext.Provider value={stage}>
          <Suspense key={pathname} fallback={<ChunkPending />}>
            {children}
          </Suspense>
        </StageContext.Provider>
      </div>
    </div>
  );
};

export default PageStage;
