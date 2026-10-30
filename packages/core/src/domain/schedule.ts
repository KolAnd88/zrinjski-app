// schedule.ts — auto-satnica.
//
// Ulaz: redoslijed utakmica po danu, početak prve utakmice (po danu),
//       trajanje utakmice + razmak (iz tournament), pauze u dvorani.
// Izlaz: svakoj utakmici dodijeljeno vrijeme početka.
// Kašnjenje uživo → pomak svih kasnijih utakmica + signal "promjena satnice".
//
// Igra se na JEDNOM terenu, pa pravilo razmaka vrijedi između svih utakmica
// dana, muških i ženskih zajedno.

import { addMinutesToTime, combineDateTime, minutesToTime, timeToMinutes } from './time';

export type ScheduleParams = {
  matchDurationMin: number;
  gapMin: number;
};

/** Pauza u dvorani (otvaranje turnira, ručak) — u njoj se ne igra. */
export type Pause = {
  /** "HH:MM" */
  start: string;
  durationMin: number;
};

export type DayInput = {
  dayId: string;
  date: string;            // "YYYY-MM-DD"
  firstMatchTime: string | null; // "HH:MM"; null = samo program (bez utakmica)
  /** id-evi utakmica u redoslijedu igranja (već sortirano po sort_order). */
  matchIds: string[];
  /** Pauze tog dana; generiranje ih preskače. */
  pauses?: Pause[];
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
 * Prvi trenutak od `startMin` u kojem utakmica od `durationMin` ne ulazi ni u
 * jednu pauzu. Utakmica koja bi zahvatila pauzu kreće kad pauza završi.
 */
export function skipPauses(startMin: number, durationMin: number, pauses: Pause[] = []): number {
  const sorted = pauses
    .map((p) => ({ s: timeToMinutes(p.start), e: timeToMinutes(p.start) + p.durationMin }))
    .sort((a, b) => a.s - b.s);
  let t = startMin;
  for (const p of sorted) {
    if (t < p.e && t + durationMin > p.s) t = p.e;
  }
  return t;
}

/**
 * Generira satnicu za jedan dan: prva utakmica u `firstMatchTime`, svaka sljedeća
 * pomaknuta za (trajanje + razmak), preko pauza. Ako dan nema `firstMatchTime`
 * ili nema utakmica, vraća prazno polje.
 *
 * Bez zadanog `tzOffsetMinutes` uzima se stvarni pomak zone turnira za taj dan.
 */
export function generateDaySchedule(
  day: DayInput,
  params: ScheduleParams,
  tzOffsetMinutes?: number
): ScheduledMatch[] {
  if (!day.firstMatchTime || day.matchIds.length === 0) return [];
  const step = params.matchDurationMin + params.gapMin;
  let t = timeToMinutes(day.firstMatchTime);
  return day.matchIds.map((matchId, i) => {
    t = skipPauses(t, params.matchDurationMin, day.pauses);
    const time = minutesToTime(t);
    t += step;
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
  tzOffsetMinutes?: number
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
  tzOffsetMinutes?: number
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

// ── Ručni termini ──────────────────────────────────────────────────────────

/** Zašto se utakmica ne može staviti u zadani termin. */
export type SlotConflict =
  | { kind: 'too_close'; otherId: string; otherTime: string; minGap: number }
  | { kind: 'in_pause'; title: string; start: string; end: string };

/**
 * Sudara li se termin s drugom utakmicom ili pauzom istog dana.
 *
 * Jedan teren: između početaka dviju utakmica mora proći barem trajanje +
 * razmak. Utakmica ne smije ni zahvatiti pauzu — ako počne pet minuta prije
 * otvaranja turnira, otvaranje bi čekalo.
 */
export function slotConflicts(input: {
  matchId: string;
  /** "HH:MM" */
  start: string;
  /** Ostale utakmice ISTOG dana, "HH:MM". */
  others: { id: string; start: string }[];
  pauses: (Pause & { title: string })[];
  params: ScheduleParams;
}): SlotConflict[] {
  const { params } = input;
  const minGap = params.matchDurationMin + params.gapMin;
  const s = timeToMinutes(input.start);
  const out: SlotConflict[] = [];
  for (const o of input.others) {
    if (o.id === input.matchId) continue;
    if (Math.abs(timeToMinutes(o.start) - s) < minGap) {
      out.push({ kind: 'too_close', otherId: o.id, otherTime: o.start, minGap });
    }
  }
  for (const p of input.pauses) {
    const ps = timeToMinutes(p.start);
    const pe = ps + p.durationMin;
    if (s < pe && s + params.matchDurationMin > ps) {
      out.push({ kind: 'in_pause', title: p.title, start: p.start, end: minutesToTime(pe) });
    }
  }
  return out;
}

/**
 * "Pomakni i sve iza": utakmica dobiva novi termin, a sve kasnije istog dana
 * pomiču se za isto, s tim da nijedna ne dođe bliže prethodnoj od trajanja +
 * razmaka i nijedna ne uđe u pauzu.
 *
 * `day` su utakmice dana kronološki ("HH:MM"). Vraća nove termine samo za
 * utakmice koje se mijenjaju.
 */
export function shiftFollowing(input: {
  day: { id: string; start: string; movable: boolean }[];
  matchId: string;
  newStart: string;
  pauses: Pause[];
  params: ScheduleParams;
}): { id: string; start: string }[] | null {
  const { day, params } = input;
  const idx = day.findIndex((m) => m.id === input.matchId);
  if (idx === -1) return null;
  const step = params.matchDurationMin + params.gapMin;
  const delta = timeToMinutes(input.newStart) - timeToMinutes(day[idx]!.start);

  const out: { id: string; start: string }[] = [];
  let prev = idx > 0 ? timeToMinutes(day[idx - 1]!.start) : -Infinity;
  for (let i = idx; i < day.length; i++) {
    const m = day[i]!;
    // Odigrana ili tekuća utakmica se ne pomiče — a ono iza nje ne može
    // preskočiti preko nje, pa se lanac tu prekida.
    if (i > idx && !m.movable) break;
    let t = Math.max(timeToMinutes(m.start) + delta, prev + step);
    t = skipPauses(t, params.matchDurationMin, input.pauses);
    if (t >= 24 * 60) return null;
    const start = minutesToTime(t);
    if (start !== m.start) out.push({ id: m.id, start });
    prev = t;
  }
  return out;
}
