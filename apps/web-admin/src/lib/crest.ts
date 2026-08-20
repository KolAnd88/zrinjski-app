// crest.ts — pomoć za grb kad ekipa nema unesenu kraticu (npr. prijave).
// Boja grba se NE bira ručno: računa se iz indeksa (crestColorFor u @zrinjski/ui-tokens).
export { crestColorFor } from '@zrinjski/ui-tokens';

/** Kratica iz naziva: 3 slova prve riječi (ili inicijali prvih riječi). */
export function autoShortCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
