import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query.
 *
 * useSyncExternalStore rather than useState + useEffect on resize: matchMedia
 * is an external store, and reading it into state inside an effect means a
 * setState in the effect body on every mount, which is both an extra render
 * and a react-hooks/set-state-in-effect error. This also fires only when the
 * query result actually flips, instead of on every resize event.
 */
const useMediaQuery = (query) => {
  const subscribe = useCallback(
    (onStoreChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // No window while server-rendering or in a non-DOM test environment; assume
  // the query does not match so the desktop layout is the default.
  const getServerSnapshot = () => false;

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

export default useMediaQuery;
