// crest.ts — pomoć za grb kad ekipa nema unesenu kraticu/boju (npr. prijave).
import { colors } from '@zrinjski/ui-tokens';

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

/** Deterministička boja iz naziva (stabilan grb dok ekipa ne dobije svoju boju). */
export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const palette = colors.teamColors;
  return palette[h % palette.length]!;
}
