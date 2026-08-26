// reorder.ts — ručna izmjena redoslijeda utakmica unutar dana.
//
// Satnica se generira automatski, ali ekipe znaju tražiti drugi termin ("ne
// stižemo u 10:20"). Umjesto ponovnog generiranja cijelog dana — koje bi
// pobrisalo zabilježena kašnjenja (shiftScheduleFrom) — dvije utakmice
// jednostavno ZAMIJENE termin i mjesto u redu.

export type SlotMatch = {
  id: string;
  day_id: string | null;
  sort_order: number;
  scheduled_time: string | null;
};

/**
 * Susjedna utakmica istog dana, u smjeru `dir`.
 * Vraća null na rubovima (prva gore, zadnja dolje) i za utakmicu bez dana.
 */
export function adjacentInDay<T extends SlotMatch>(
  matches: T[],
  matchId: string,
  dir: 'up' | 'down'
): T | null {
  const me = matches.find((m) => m.id === matchId);
  if (!me || !me.day_id) return null;

  const sameDay = matches
    .filter((m) => m.day_id === me.day_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

  const i = sameDay.findIndex((m) => m.id === matchId);
  if (i < 0) return null;
  return sameDay[dir === 'up' ? i - 1 : i + 1] ?? null;
}

export type SlotPatch = { id: string; sort_order: number; scheduled_time: string | null };

/**
 * Zamijeni dvije utakmice: i mjesto u redu i termin.
 *
 * Termin ide zajedno s mjestom jer je satnica vezana uz redoslijed — kad bi se
 * mijenjao samo sort_order, popis bi se prerasporedio ali bi vremena ostala na
 * starim utakmicama i raspored bi lagao.
 */
export function swapSlots(a: SlotMatch, b: SlotMatch): [SlotPatch, SlotPatch] {
  return [
    { id: a.id, sort_order: b.sort_order, scheduled_time: b.scheduled_time },
    { id: b.id, sort_order: a.sort_order, scheduled_time: a.scheduled_time },
  ];
}
