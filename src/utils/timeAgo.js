const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * "3 minutes ago", "yesterday", "2 weeks ago". Anything under a minute is
 * "just now"; a missing or unreadable date is an empty string.
 */
export const timeAgo = (date, now = Date.now()) => {
  const then = new Date(date).getTime();
  if (!date || Number.isNaN(then)) return '';

  const seconds = Math.round((then - now) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.round(seconds / size), unit);
  }
  return 'just now';
};

export default timeAgo;
