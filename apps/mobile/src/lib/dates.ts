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

/** Kratica dana u tjednu: "Pet". */
export function weekdayShort(isoDate: string, locale: Locale): string {
  return weekdayLong(isoDate, locale).slice(0, 3);
}

/** Datum bez godine: "6.6." — za birač dana u Rasporedu. */
export function dayMonth(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}

/** Oznaka taba: "Sub 10." (kratki dan + datum). */
export function tabLabel(isoDate: string, locale: Locale): string {
  const d = parseIsoDate(isoDate);
  return `${weekdayLong(isoDate, locale).slice(0, 3)} ${String(d.getUTCDate()).padStart(2, '0')}.`;
}

const MONTH_GEN_HR = [
  'siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja',
  'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca',
];
const MONTH_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Naslov dana: "SUBOTA · 7. lipnja" / "Saturday · July 7". */
export function dayTitle(isoDate: string, locale: Locale): string {
  const d = parseIsoDate(isoDate);
  const wd = weekdayLong(isoDate, locale);
  if (locale === 'hr') {
    return `${wd.toUpperCase()} · ${d.getUTCDate()}. ${MONTH_GEN_HR[d.getUTCMonth()]}`;
  }
  return `${wd} · ${MONTH_EN[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * "HH:MM" iz ISO timestampa, u LOKALNOJ zoni uređaja.
 * VAŽNO: Postgres (timestamptz) vraća vremena u UTC — rezanje sata iz stringa
 * prikazivalo bi 2h krivo. Publika i turnir su u istoj zoni pa je lokalno točno.
 */
export function isoToHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "HH:MM:SS"/"HH:MM" Postgres time → "HH:MM". */
export function timeToHHMM(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : '';
}
