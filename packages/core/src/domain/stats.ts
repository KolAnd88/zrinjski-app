// stats.ts — agregacija statistike iz match_event.
//
// 4 kategorije (PROJEKT.md): Strijelci (goal), Vratari (save), Isključenja (suspension_2min),
// Crveni (red_card). Odvojeno po spolu (filtriraj utakmice prije poziva).
// Najbolji strijelac = automatski (vrh liste). Najbolji igrač turnira = ručno polje (admin).

import type { EventType, MatchEvent } from '../types/database';

export type StatRow = {
  playerId: string;
  count: number;
  rank: number;
};

export type StatCategory = 'scorers' | 'goalkeepers' | 'suspensions' | 'red_cards';

const CATEGORY_EVENT: Record<StatCategory, EventType> = {
  scorers: 'goal',
  goalkeepers: 'save',
  suspensions: 'suspension_2min',
  red_cards: 'red_card',
};

/**
 * Rangiraj igrače po broju događaja zadanog tipa.
 * `events` treba već biti filtriran na odgovarajući skup utakmica (npr. po spolu).
 */
export function rankByEvent(
  events: Pick<MatchEvent, 'player_id' | 'type'>[],
  category: StatCategory
): StatRow[] {
  const target = CATEGORY_EVENT[category];
  const counts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== target || !e.player_id) continue;
    counts.set(e.player_id, (counts.get(e.player_id) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([playerId, count]) => ({ playerId, count, rank: 0 }))
    .sort((a, b) => b.count - a.count);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Sve 4 kategorije odjednom. */
export function aggregateStats(
  events: Pick<MatchEvent, 'player_id' | 'type'>[]
): Record<StatCategory, StatRow[]> {
  return {
    scorers: rankByEvent(events, 'scorers'),
    goalkeepers: rankByEvent(events, 'goalkeepers'),
    suspensions: rankByEvent(events, 'suspensions'),
    red_cards: rankByEvent(events, 'red_cards'),
  };
}

/** Najbolji strijelac (vrh liste strijelaca) ili null ako nema golova. */
export function topScorer(
  events: Pick<MatchEvent, 'player_id' | 'type'>[]
): StatRow | null {
  return rankByEvent(events, 'scorers')[0] ?? null;
}
