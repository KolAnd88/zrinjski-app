// dates.ts — lokalizirani datumi/vrijeme za prikaz.
import { parseIsoDate } from '@zrinjski/core';
import type { Locale } from '../i18n/strings';

const WEEKDAYS_LONG: Record<Locale, string[]> = {
  // indeks 0 = ponedjeljak
  hr: ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function weekdayLong(isoDate: string, locale: Locale): string {
  return WEEKDAYS_LONG[locale][mondayIndex(parseIsoDate(isoDate).getUTCDay())] ?? '';
}

/** "YYYY-MM-DD" → "Petak, 10.7.2026." */
export function formatDayLabel(isoDate: string, locale: Locale): string {
  const d = parseIsoDate(isoDate);
  return `${weekdayLong(isoDate, locale)}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}.`;
}

/** Kratki dan: "Pet 10.7." */
export function shortDayLabel(isoDate: string, locale: Locale): string {
  const d = parseIsoDate(isoDate);
  return `${weekdayLong(isoDate, locale).slice(0, 3)} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** "HH:MM" iz ISO timestampa (neovisno o zoni preglednika). */
export function isoToHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** "HH:MM:SS"/"HH:MM" Postgres time → "HH:MM". */
export function timeToHHMM(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : '';
}
