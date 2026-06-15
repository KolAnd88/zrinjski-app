// dateLabels.ts — lokalizirani nazivi mjeseci/dana za kalendar i prikaz datuma.
import { parseIsoDate } from '@zrinjski/core';
import type { Locale } from './strings';

const MONTHS: Record<Locale, string[]> = {
  hr: [
    'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
    'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac',
  ],
  en: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
};

// Tjedan počinje ponedjeljkom (kao u mockupu).
const WEEKDAYS_SHORT: Record<Locale, string[]> = {
  hr: ['Po', 'Ut', 'Sr', 'Če', 'Pe', 'Su', 'Ne'],
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
};

const WEEKDAYS_LONG: Record<Locale, string[]> = {
  // Indeks 0 = ponedjeljak
  hr: ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

export function monthName(monthIndex0: number, locale: Locale): string {
  return MONTHS[locale][monthIndex0] ?? '';
}

export function weekdayHeaders(locale: Locale): string[] {
  return WEEKDAYS_SHORT[locale];
}

/** JS getUTCDay() (0=nedjelja) → indeks s ponedjeljkom kao 0. */
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function weekdayLong(isoDate: string, locale: Locale): string {
  const d = parseIsoDate(isoDate);
  return WEEKDAYS_LONG[locale][mondayIndex(d.getUTCDay())] ?? '';
}

/** "YYYY-MM-DD" → "Petak, 6.6.2026." (lokalizirani dan + D.M.YYYY.). */
export function formatDayLabel(isoDate: string, locale: Locale): string {
  const d = parseIsoDate(isoDate);
  const wd = weekdayLong(isoDate, locale);
  return `${wd}, ${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}.`;
}
