// dizajn/tokens.ts
// Dizajn tokeni za VHMRK Zrinjski Cup. Koristi OVE vrijednosti svuda — ne hardkodiraj boje/razmake.
// Vidi DIZAJN.md i ekrani/ds_foundations.png, ds_components.png.

export const colors = {
  // Brend / akcent
  red: "#E11D2A",     // primarni akcent, akcije, UŽIVO
  redDk: "#9C0C18",   // lenta, gradijenti
  blue: "#2D6CDF",    // sekundarno, Karta/info
  gold: "#D9B24A",    // SAMO zlatni sponzor + finale

  // Površine (tamna tema — jedina tema)
  bg: "#0B0B0E",
  card: "#15161B",
  card2: "#1C1D24",
  line: "#2A2B33",

  // Tekst
  txt: "#F4F4F5",
  sub: "#9AA0AA",
  mut: "#6B7079",

  // Status
  green: "#22C55E",   // uspjeh / prolaz u završnicu / odobri

  // Boje gostujućih ekipa (primjeri — stvarne se biraju u adminu)
  teamColors: ["#E11D2A", "#2D6CDF", "#6A1FB0", "#1F7A8C", "#C2410C", "#0D9488", "#B03060", "#0E7490"],
} as const;

// 8pt ritam
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { card: 12, chip: 8, pill: 999 } as const;

export const typography = {
  // Oswald = naslovi/rezultati/oznake (često UPPERCASE, blagi letter-spacing)
  // Sustavni sans / Inter = tekst/opisi/tablice
  display: { family: "Oswald", weight: "700", size: 56 },   // rezultat (skalira 40–120)
  h1:      { family: "Oswald", weight: "700", size: 26 },
  h2:      { family: "Oswald", weight: "600", size: 18, uppercase: true, letterSpacing: 0.5 },
  label:   { family: "Oswald", weight: "700", size: 11, uppercase: true, letterSpacing: 1 },
  body:    { family: "Inter",  weight: "400", size: 15 },
  bodyStrong: { family: "Inter", weight: "600", size: 14 },
  caption: { family: "Inter",  weight: "400", size: 12 },
} as const;

export const layout = {
  phoneWidth: 390,
  webAdmin: { width: 1280, height: 800 },
  minTouchTarget: 44,
} as const;

// Semantička pravila (vrlo važno):
// - UŽIVO / realtime stanja = colors.red
// - Finale i zlatni sponzor = colors.gold (NIŠTA drugo nije zlatno)
// - Prolaz u završnicu / odobreno = colors.green
// - Admin = crveno zaglavlje + izbornik u pločicama; korisnik = donja navigacija (6 stavki)
