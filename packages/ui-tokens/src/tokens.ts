// @zrinjski/ui-tokens — dizajn tokeni. Izvor istine: dizajn/tokens.ts + DIZAJN.md.
// Koristi OVE vrijednosti svuda — ne hardkodiraj boje/razmake.

export const colors = {
  // Brend / akcent
  red: '#E11D2A',     // primarni akcent, akcije, UŽIVO
  redDk: '#9C0C18',   // lenta, gradijenti
  redLt: '#FF5662',   // live tekst, countdown
  redNav: '#FF4651',  // aktivna ikona u tab baru
  blue: '#2D6CDF',    // tekstualni linkovi ("Cijeli raspored"), Karta/info
  gold: '#D9B24A',    // SAMO zlatni sponzor + finale
  goldTxt: '#C9B26A', // podnaslov zlatnog sponzora

  // Površine (tamna tema — jedina tema)
  bg: '#0B0B0E',
  card: '#15161B',
  cardHi: '#1A1B21',  // gornji stop gradijenta kartice
  cardLo: '#121217',  // donji stop gradijenta kartice
  card2: '#1C1D24',
  line: '#2A2B33',    // rub kartice
  lineSub: '#23242C', // separator, rub ekrana
  lineRow: '#1D1E25', // separator redova u listi

  // Tekst
  txt: '#F4F4F5',
  txt2: '#C9CDD4',    // sekundarni tekst
  sub: '#9AA0AA',     // labeli, meta
  mut: '#6B7079',     // "vs", neaktivni brojevi
  navOff: '#7A8089',  // neaktivna ikona u tab baru

  // Status
  green: '#22C55E',   // uspjeh / prolaz u završnicu / odobri
} as const;

// Grbovi ekipa — gradijent (150deg) + 3 slova, u zaobljenom kvadratu.
// Dodjeljuju se po indeksu ekipe; ponavljanje je OK jer boja NIJE nositelj
// informacije (ne označava grupu, plasman ni status). Ekipa koja ima upisan
// `team.color` dobiva njega umjesto palete — tako klub domaćin može nositi crvenu.
export const teamCrest = [
  ['#2596A8', '#1F7A8C'], // teal
  ['#7D27CC', '#4A127F'], // ljubičasta
  ['#D4500F', '#C2410C'], // narančasta
  ['#2D6CDF', '#1E4FA3'], // plava
  ['#2FA36A', '#1F7A4F'], // zelena
  ['#B23A54', '#6B2233'], // burgundy
] as const;

/** Brend-crveni grb — samo za ekipu kojoj je izričito dodijeljen (npr. domaćin). */
export const crestRed = ['#E11D2A', '#9C0C18'] as const;

export type CrestGradient = readonly [string, string];

export const crestGradientFor = (index: number): CrestGradient =>
  teamCrest[((index % teamCrest.length) + teamCrest.length) % teamCrest.length]!;

/** CSS zapis gradijenta grba (web admin); mobilna koristi expo-linear-gradient. */
export const crestCss = (g: CrestGradient) => `linear-gradient(150deg,${g[0]},${g[1]})`;

/**
 * Indeksi boja za par ekipa u istoj utakmici (hero, red rasporeda, semafor).
 * Paleta ima 6 boja, a konkurencija ih zna imati 12+ — pa se dvije ekipe mogu
 * poklopiti. Tada boju pomiče SAMO gost; kad bi se pomicale obje, opet bi
 * završile na istoj. Ponavljanje kroz cijeli popis je i dalje u redu, ali dva
 * ista grba u istoj utakmici izgledaju kao greška.
 */
export const crestPair = (homeIndex: number, awayIndex: number): [number, number] => {
  const n = teamCrest.length;
  const norm = (i: number) => ((i % n) + n) % n;
  const a = norm(homeIndex);
  const b = norm(awayIndex);
  return a === b ? [a, (b + 1) % n] : [a, b];
};

/** Prva (svjetlija) boja gradijenta — kad treba ravna ploha, npr. točka u timelineu. */
export const crestSolidFor = (index: number) => crestGradientFor(index)[0];

/**
 * @deprecated Ravna boja grba. Ekrani se redizajniraju na gradijent redom
 * (vidi DIZAJN.md); ovo drži neredizajnirane ekrane na životu do tada.
 */
export const crestColorFor = crestSolidFor;

// 8pt ritam (zadržano zbog postojećih ekrana)
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Skala iz hifi makete — koristi ovu za nove/redizajnirane ekrane.
export const space = {
  hair: 4,      // najmanji odmak
  tight: 6,     // razmak u gridu hero kartice
  gap: 9,       // grb ↔ ime, label ↔ sadržaj
  rowY: 11,     // vertikalni padding reda
  divider: 13,  // padding iznad separatora
  cardGap: 14,  // razmak između kartica
  screenX: 18,  // horizontalni padding sadržaja
  headerX: 22,  // horizontalni padding headera
  section: 22,  // razmak između sekcija
} as const;

export const radius = {
  crestSm: 9,   // mali grb u listi (30px)
  chip: 11,     // chip, logo, ikona u headeru
  card: 14,     // kartica
  crestLg: 15,  // veliki grb (56px)
  hero: 20,     // hero kartica
  pill: 999,
} as const;

export const typography = {
  display: { family: 'Oswald', weight: '700', size: 56 },
  h1: { family: 'Oswald', weight: '700', size: 26 },
  h2: { family: 'Oswald', weight: '600', size: 18, uppercase: true, letterSpacing: 0.5 },
  label: { family: 'Oswald', weight: '700', size: 11, uppercase: true, letterSpacing: 1 },
  body: { family: 'Inter', weight: '400', size: 15 },
  bodyStrong: { family: 'Inter', weight: '600', size: 14 },
  caption: { family: 'Inter', weight: '400', size: 12 },
} as const;

export const layout = {
  phoneWidth: 390,
  webAdmin: { width: 1280, height: 800 },
  minTouchTarget: 44,
} as const;

// Semantička pravila:
// - UŽIVO / realtime = colors.red
// - Finale i zlatni sponzor = colors.gold (ništa drugo nije zlatno)
// - Prolaz u završnicu / odobreno = colors.green
