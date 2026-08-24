// schedule.ts — auto-satnica.
//
// Ulaz: redoslijed utakmica po danu, početak prve utakmice (po danu),
//       trajanje utakmice + razmak (iz tournament).
// Izlaz: svakoj utakmici dodijeljeno vrijeme početka.
// Kašnjenje uživo → pomak svih kasnijih utakmica + signal "promjena satnice".

import { addMinutesToTime, combineDateTime, timeToMinutes } from './time';

export type ScheduleParams = {
  matchDurationMin: number;
  gapMin: number;
};

export type DayInput = {
  dayId: string;
  date: string;            // "YYYY-MM-DD"
  firstMatchTime: string | null; // "HH:MM"; null = samo program (bez utakmica)
  /** id-evi utakmica u redoslijedu igranja (već sortirano po sort_order). */
  matchIds: string[];
};

export type ScheduledMatch = {
  matchId: string;
  dayId: string;
  /** Vrijeme početka kao "HH:MM" (lokalno). */
  time: string;
  /** ISO timestamp za spremanje u match.scheduled_time (timestamptz). */
  scheduledTime: string;
  /** Redni broj unutar dana (0-baziran). */
  orderInDay: number;
};

/**
 * Generira satnicu za jedan dan: prva utakmica u `firstMatchTime`, svaka sljedeća
 * pomaknuta za (trajanje + razmak). Ako dan nema `firstMatchTime` ili nema utakmica,
 * vraća prazno polje.
 */
export function generateDaySchedule(
  day: DayInput,
  params: ScheduleParams,
  tzOffsetMinutes = 120
): ScheduledMatch[] {
  if (!day.firstMatchTime || day.matchIds.length === 0) return [];
  const step = params.matchDurationMin + params.gapMin;
  return day.matchIds.map((matchId, i) => {
    const time = addMinutesToTime(day.firstMatchTime!, i * step);
    return {
      matchId,
      dayId: day.dayId,
      time,
      scheduledTime: combineDateTime(day.date, time, tzOffsetMinutes),
      orderInDay: i,
    };
  });
}

/** Generira satnicu za sve dane odjednom. */
export function generateSchedule(
  days: DayInput[],
  params: ScheduleParams,
  tzOffsetMinutes = 120
): ScheduledMatch[] {
  return days.flatMap((d) => generateDaySchedule(d, params, tzOffsetMinutes));
}

export type ScheduleShift = {
  matchId: string;
  newTime: string;          // "HH:MM"
  newScheduledTime: string; // ISO
};

/**
 * Kašnjenje uživo: pomakni `fromMatchId` i sve KASNIJE utakmice istog dana za
 * `delayMin` minuta. Vraća samo pomaknute utakmice (za UPDATE + push "promjena satnice").
 * Ako `fromMatchId` nije u danu, vraća prazno polje.
 */
export function shiftDaySchedule(
  day: DayInput,
  params: ScheduleParams,
  fromMatchId: string,
  delayMin: number,
  tzOffsetMinutes = 120
): ScheduleShift[] {
  const base = generateDaySchedule(day, params, tzOffsetMinutes);
  const startIdx = base.findIndex((m) => m.matchId === fromMatchId);
  if (startIdx === -1 || delayMin === 0) return [];
  return base.slice(startIdx).map((m) => {
    const newTime = addMinutesToTime(m.time, delayMin);
    return {
      matchId: m.matchId,
      newTime,
      newScheduledTime: combineDateTime(day.date, newTime, tzOffsetMinutes),
    };
  });
}

/** Pomoć: trajanje cijelog dana u minutama (od prve do kraja zadnje utakmice). */
export function dayDurationMinutes(day: DayInput, params: ScheduleParams): number {
  if (!day.firstMatchTime || day.matchIds.length === 0) return 0;
  const n = day.matchIds.length;
  // n utakmica, (n-1) razmaka između njih.
  return n * params.matchDurationMin + (n - 1) * params.gapMin;
}

export { timeToMinutes };

/**
 * Koji dan turnira prikazati pri otvaranju Rasporeda.
 *  • traje turnir → današnji dan
 *  • prije turnira → prvi dan
 *  • poslije      → zadnji dan (rezultati zadnjeg dana)
 *
 * `todayIso` se predaje izvana ("YYYY-MM-DD", lokalni datum uređaja) — tako
 * funkcija nema skriveno stanje i može se testirati.
 */
export function pickCurrentDayId(
  days: { id: string; date: string }[],
  todayIso: string
): string | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const today = sorted.find((d) => d.date === todayIso);
  if (today) return today.id;

  const upcoming = sorted.find((d) => d.date > todayIso);
  return (upcoming ?? sorted[sorted.length - 1]!).id;
}
