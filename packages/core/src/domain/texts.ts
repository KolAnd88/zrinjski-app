/**
 * Odabir dvojezičnog teksta turnira (pravila, format, o klubu).
 *
 * Organizator piše na hrvatskom; engleski je neobavezan. Zato prazan engleski
 * NIJE greška nego uobičajeno stanje, a pravilo je jednostavno: pokaži tekst
 * na traženom jeziku ako postoji, inače hrvatski. Bolje razumljiv hrvatski
 * nego prazan ekran.
 *
 * Prazan i razmakom ispunjen tekst tretiraju se isto — polje koje sadrži samo
 * razmake korisnik je ostavio praznim, bez obzira što baza ondje ima znakove.
 */
export type TextLocale = 'hr' | 'en';

function clean(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : null;
}

/**
 * Vraća tekst za traženi jezik, uz povrat na hrvatski.
 * `null` znači da nema ničega ni na jednom jeziku — pozivatelj tada odlučuje
 * hoće li sakriti odjeljak ili pokazati vlastiti zadani tekst.
 */
export function pickText(
  hr: string | null | undefined,
  en: string | null | undefined,
  locale: TextLocale
): string | null {
  const h = clean(hr);
  if (locale === 'hr') return h;
  return clean(en) ?? h;
}

/** Ima li ijedan jezik sadržaj — za odluku prikazuje li se odjeljak uopće. */
export function hasText(
  hr: string | null | undefined,
  en: string | null | undefined
): boolean {
  return clean(hr) !== null || clean(en) !== null;
}
