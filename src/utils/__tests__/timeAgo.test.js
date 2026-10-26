import { describe, expect, it } from 'vitest';
import { timeAgo } from '../timeAgo';

const NOW = new Date('2026-10-03T12:00:00Z').getTime();
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString();

describe('timeAgo', () => {
  it('says "just now" for the last minute', () => {
    expect(timeAgo(ago(20), NOW)).toBe('just now');
  });

  it('picks the largest whole unit', () => {
    expect(timeAgo(ago(5 * 60), NOW)).toBe('5 minutes ago');
    expect(timeAgo(ago(3 * 3600), NOW)).toBe('3 hours ago');
    expect(timeAgo(ago(24 * 3600), NOW)).toBe('yesterday');
    expect(timeAgo(ago(15 * 24 * 3600), NOW)).toBe('2 weeks ago');
  });

  it('returns nothing for a missing or broken date', () => {
    expect(timeAgo(undefined, NOW)).toBe('');
    expect(timeAgo('not a date', NOW)).toBe('');
  });
});
