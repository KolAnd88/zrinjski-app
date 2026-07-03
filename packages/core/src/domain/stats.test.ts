import { describe, expect, it } from 'vitest';
import { aggregateStats, rankByEvent, topScorer } from './stats';
import type { EventType } from '../types/database';

const ev = (player_id: string | null, type: EventType) => ({ player_id, type });

const events = [
  ev('p1', 'goal'),
  ev('p1', 'goal'),
  ev('p2', 'goal'),
  ev('g1', 'save'),
  ev('p3', 'suspension_2min'),
  ev('p3', 'red_card'),
  ev(null, 'goal'), // gol bez igrača (ručna korekcija) — ne ulazi u rang
];

describe('rankByEvent', () => {
  it('broji i rangira po broju događaja', () => {
    const rows = rankByEvent(events, 'scorers');
    expect(rows[0]).toMatchObject({ playerId: 'p1', count: 2, rank: 1 });
    expect(rows[1]).toMatchObject({ playerId: 'p2', count: 1, rank: 2 });
  });

  it('događaji bez igrača se preskaču', () => {
    const rows = rankByEvent(events, 'scorers');
    expect(rows.every((r) => r.playerId !== null)).toBe(true);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(3);
  });
});

describe('aggregateStats', () => {
  it('sve 4 kategorije odvojeno', () => {
    const s = aggregateStats(events);
    expect(s.scorers.length).toBe(2);
    expect(s.goalkeepers[0]).toMatchObject({ playerId: 'g1', count: 1 });
    expect(s.suspensions[0]!.playerId).toBe('p3');
    expect(s.red_cards[0]!.playerId).toBe('p3');
  });
});

describe('topScorer', () => {
  it('vrh liste ili null', () => {
    expect(topScorer(events)!.playerId).toBe('p1');
    expect(topScorer([])).toBeNull();
  });
});
