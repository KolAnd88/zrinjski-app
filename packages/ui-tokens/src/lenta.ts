// lenta.ts — dijagonalna lenta, jedini izvor istine.
//
// Lenta nije ukras nego znak: domaći dres Zrinjskog je bijeli s crvenom
// lentom i klub svoje igrače opisuje kao one koji nastupaju "u lenti".
// Zato kut nije proizvoljan — 30° je kut pod kojim lenta ide preko prsa,
// a ne plitkih 12° koji se čitaju kao natpisna traka.
//
// Prije je lenta postojala na šest mjesta s pet različitih kutova
// (-62°, -28°, -12°, -10°) i tri različite jačine. Sve sada crta odavde.

import { colors } from './tokens';

export const LENTA = {
  /** Kut s dresa. Negativan = uzlazno slijeva nadesno. */
  angleDeg: -30,
  /**
   * Debljina glavne lente, udio KRAĆE stranice kadra. Kraće, jer bi na
   * uspravnom plakatu udio visine dao lentu duplo predebelu nego na slici
   * rezultata — a lenta mora izgledati jednako na oboje.
   */
  band: 0.222,
  /** Tanka oštra crta iznad lente. */
  hairline: 0.008,
  /** Razmak između crte i lente. */
  gap: 0.022,
  /**
   * Jačina po namjeni. Puna ide na slike gdje je tekst krupan i bijel;
   * `soft` ondje gdje lenta stoji iza više sadržaja; `quiet` iza gustog
   * teksta, gdje smije samo naznačiti boju.
   */
  strength: { full: 1, soft: 0.82, quiet: 0.3 },
} as const;

export type LentaStrength = keyof typeof LENTA.strength;

export type LentaSvgOpts = {
  w: number;
  h: number;
  /** Sredina lente po visini kadra, 0..1. */
  cy?: number;
  strength?: number;
  /** Zlatna nit umjesto crvene — SAMO finale i zlatni pokrovitelj. */
  gold?: boolean;
  /** Razlikovni nastavak kad je više lenta u istom dokumentu. */
  id?: string;
};

/**
 * Lenta za SVG površine (slika rezultata, plakat, TV).
 *
 * Vraća `defs` i `body` odvojeno jer SVG traži da gradijenti budu u
 * `<defs>`. Duljina se računa iz kadra i kuta: pod 30° lenta mora biti
 * osjetno duža od širine slike da joj krajevi padnu izvan kadra.
 */
export function lentaSvg(o: LentaSvgOpts): { defs: string; body: string } {
  const { w, h, cy = 0.5, strength = LENTA.strength.full, gold = false } = o;
  const id = o.id ?? 'lenta';
  const rad = (Math.abs(LENTA.angleDeg) * Math.PI) / 180;
  // Dijagonalna traka mora prekriti kadar u oba smjera, plus rezerva.
  const len = w * Math.cos(rad) + h * Math.sin(rad) + 80;
  const x = w / 2 - len / 2;

  const base = Math.min(w, h);
  const band = Math.round(base * LENTA.band);
  const hair = Math.max(3, Math.round(base * LENTA.hairline));
  const gap = Math.round(base * LENTA.gap);
  const mid = Math.round(h * cy);
  const top = mid - Math.round(band / 2);
  const nit = gold ? colors.gold : colors.red;

  const defs = `
    <linearGradient id="${id}-b" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.redDk}" stop-opacity="0"/>
      <stop offset="0.34" stop-color="${colors.redDk}" stop-opacity="0.7"/>
      <stop offset="0.7" stop-color="${colors.red}" stop-opacity="0.76"/>
      <stop offset="1" stop-color="${colors.red}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-n" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${nit}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${nit}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${nit}" stop-opacity="0"/>
    </linearGradient>`;

  // Rotira se oko SREDINE LENTE, ne oko sredine kadra: inače bi lenta
  // postavljena pri vrhu (plakat) pod kutom otklizala u stranu i dolje.
  const body = `<g transform="rotate(${LENTA.angleDeg} ${w / 2} ${mid})" opacity="${strength}">
    <rect x="${x}" y="${top - gap - hair}" width="${len}" height="${hair}" fill="url(#${id}-n)"/>
    <rect x="${x}" y="${top}" width="${len}" height="${band}" fill="url(#${id}-b)"/>
  </g>`;

  return { defs, body };
}

/**
 * Iste boje za React Native, gdje se lenta slaže od pogleda umjesto od SVG-a.
 * `locations` odgovaraju `offset` vrijednostima gore — ako se jedno mijenja,
 * mijenja se i drugo.
 */
export const LENTA_RN = {
  colors: ['rgba(156,12,24,0)', 'rgba(156,12,24,.7)', 'rgba(225,29,42,.76)', 'rgba(225,29,42,0)'],
  locations: [0, 0.34, 0.7, 1],
  nit: ['rgba(225,29,42,0)', 'rgba(225,29,42,.95)', 'rgba(225,29,42,0)'],
  nitGold: ['rgba(217,178,74,0)', 'rgba(217,178,74,.95)', 'rgba(217,178,74,0)'],
} as const;
