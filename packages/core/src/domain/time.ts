// time.ts — pomoćne funkcije za vrijeme/datum.
// Format vremena: "HH:MM". Format datuma za prikaz: "D.M.YYYY.".

/** "HH:MM" → minute od ponoći. */
export function timeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) throw new Error(`Neispravan format vremena: "${time}" (očekivano HH:MM)`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) {
    throw new Error(`Vrijeme izvan raspona: "${time}"`);
  }
  return h * 60 + min;
}

/** Minute od ponoći → "HH:MM" (24h, vodeća nula). Prelijevanje preko 24h se omata. */
export function minutesToTime(total: number): string {
  const wrapped = ((Math.round(total) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:MM" + minute → "HH:MM". */
export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

/** Dan u tjednu (hr) iz datuma "YYYY-MM-DD". */
const WEEKDAYS_HR = [
  'nedjelja', 'ponedjeljak', 'utorak', 'srijeda',
  'četvrtak', 'petak', 'subota',
] as const;

export function weekdayHr(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return WEEKDAYS_HR[d.getUTCDay()]!;
}

/** "YYYY-MM-DD" → "D.M.YYYY." (format za prikaz iz CLAUDE.md). */
export function formatDateHr(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}.`;
}

/** Parsira "YYYY-MM-DD" u UTC Date (bez TZ pomaka — čista kalendarska vrijednost). */
export function parseIsoDate(isoDate: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) throw new Error(`Neispravan datum: "${isoDate}" (očekivano YYYY-MM-DD)`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Zona turnira. Mostar; ista je i za Hrvatsku i za većinu dijaspore. */
export const TOURNAMENT_TZ = 'Europe/Sarajevo';

/**
 * Pomak zone od UTC u minutama za zadani datum i sat u toj zoni
 * (Europe/Sarajevo ljeti +120, zimi +60).
 *
 * Prije je pomak bio zakucan na +120 jer se mislilo da je turnir ljeti. Turnir
 * je u studenom, kad je pomak +60: utakmica postavljena za 10:00 spremala se
 * kao 08:00 UTC, a telefoni bi je prikazali u 09:00.
 */
export function zoneOffsetMinutes(isoDate: string, time: string, timeZone = TOURNAMENT_TZ): number {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!dm) throw new Error(`Neispravan datum: "${isoDate}"`);
  const total = timeToMinutes(time);
  // Zidni sat protumačen kao da je UTC; razlika do stvarnog zidnog sata u
  // zoni u tom trenutku je upravo pomak zone.
  const guess = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Math.floor(total / 60), total % 60);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((wall - guess) / 60000);
}

/**
 * Spaja datum + "HH:MM" + pomak zone u ISO timestamp (za spremanje u timestamptz).
 * Bez zadanog pomaka uzima se stvarni pomak zone turnira za taj dan.
 * Vrati npr. "2026-11-06T10:00:00+01:00".
 */
export function combineDateTime(
  isoDate: string,
  time: string,
  tzOffsetMinutes: number = zoneOffsetMinutes(isoDate, time)
): string {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!dm) throw new Error(`Neispravan datum: "${isoDate}"`);
  const total = timeToMinutes(time);
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  const sign = tzOffsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(tzOffsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  return `${dm[1]}-${dm[2]}-${dm[3]}T${hh}:${mm}:00${sign}${oh}:${om}`;
}
