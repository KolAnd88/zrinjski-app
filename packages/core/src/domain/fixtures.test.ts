import { describe, expect, it } from 'vitest';
import { roundRobinCount, roundRobinPairings } from './fixtures';

describe('roundRobinPairings', () => {
  it.each([2, 3, 4, 5, 6, 12])('n=%i: točan broj utakmica, svaki par točno jednom', (n) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i}`);
    const pairs = roundRobinPairings(ids);
    expect(pairs.length).toBe(roundRobinCount(n));

    const seen = new Set<string>();
    for (const p of pairs) {
      expect(p.home).not.toBe(p.away);
      const key = [p.home, p.away].sort().join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe((n * (n - 1)) / 2);
  });

  it('rubni slučajevi: 0 i 1 ekipa → prazno', () => {
    expect(roundRobinPairings([])).toEqual([]);
    expect(roundRobinPairings(['a'])).toEqual([]);
  });
});

describe('roundRobinCount', () => {
  it('n*(n-1)/2', () => {
    expect(roundRobinCount(6)).toBe(15);
    expect(roundRobinCount(1)).toBe(0);
  });
});
