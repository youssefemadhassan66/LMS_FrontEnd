// Tracks in-flight API requests so the dashboard can tell when a page that was
// just opened has finished loading its data.
//
// Every page fetches through useFetchData or useApiRequest, and both register
// here. Without this, a page renders its empty state ("0 total", "No tasks
// found") the instant it mounts and only swaps in real data a second later,
// which reads as a bug rather than as loading.

let nextId = 0;
const pending = new Map(); // id -> start time (ms)
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());

export const requestClock = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/**
 * Marks a request as started and returns the function that marks it finished.
 * Call it before the first `await` so the request is visible immediately.
 */
export const beginRequest = () => {
  const id = ++nextId;
  pending.set(id, requestClock());
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending.delete(id);
    emit();
  };
};

/** Registers a request for as long as `promise` is unsettled; returns it unchanged. */
export const trackRequest = (promise) => {
  const end = beginRequest();
  promise.then(end, end);
  return promise;
};

/** How many requests that started inside [from, to] are still in flight. */
export const pendingBetween = (from, to = Infinity) => {
  let count = 0;
  pending.forEach((startedAt) => {
    if (startedAt >= from && startedAt <= to) count += 1;
  });
  return count;
};

export const subscribeRequests = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
