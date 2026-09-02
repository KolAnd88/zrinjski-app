// imageFrame.ts — računica kadra za uređivač slika.
//
// Izdvojeno iz komponente jer je ovdje jedina stvar koja stvarno može ispasti
// kriva: preslikavanje između PREGLEDA (300 px širine) i IZLAZA (900 px), te
// između okvira logotipa i pločica u aplikaciji. Ako se ta dva razmimoiđu,
// organizator namjesti jedno a dobije drugo — a to se na oko ne primijeti dok
// logo ne završi u aplikaciji.

/**
 * Okvir logotipa je isti za SVE sponzore — otud ujednačen izgled.
 *
 * Omjer nije proizvoljan. Pločice u aplikaciji imaju unutarnje omjere 2.26
 * (zlatna), 2.25 (srebrna) i 2.67 (partner). Okvir uži od NAJUŽEG od njih
 * ograničen je VISINOM u svima — pa svaki logo dobije jednaku visinu, bez
 * obzira na oblik. To je ono što se vidi kao ujednačenost.
 *
 * Ići uže (npr. 3:2) ne bi pokvarilo ujednačenost, ali bi široke natpise
 * bespotrebno smanjilo. Ići šire od najuže pločice pokvarilo bi je.
 *
 * Ako se u `home.tsx` mijenja MARQUEE_SIZE ili razmak pločice, ovaj broj se
 * mora provjeriti — test to i traži.
 */
export const FIT_W = 300;
export const FIT_H = 136;
/** Izveden iz okvira, ne obratno — inače zaokruživanje razilazi pregled i izlaz. */
export const FIT_RATIO = FIT_W / FIT_H;

/**
 * Koliko okvira logo zauzme pri automatskom uklapanju.
 *
 * 1 = do ruba. Ranije je ovdje stajalo 0.84, pa je slika NOSILA 8% praznine u
 * sebi — a pločica u aplikaciji ionako dodaje svoju. Dva ruba su se zbrajala i
 * logo je ostajao malen usred bjeline. Prazninu sada daje samo pločica.
 */
const PAD = 1;

export type Kadar = { zoom: number; x: number; y: number };

/** Zum pri kojem cijeli logo stane u okvir, s rubom. */
export function fitZoom(natW: number, natH: number, boxW: number, boxH: number): number {
  return Math.min((boxW * PAD) / natW, (boxH * PAD) / natH);
}

/** Zum pri kojem slika PREKRIVA okvir — za izrezivanje grba. */
export function coverZoom(natW: number, natH: number, boxW: number, boxH: number): number {
  return Math.max(boxW / natW, boxH / natH);
}

/** Kadar sa slikom u sredini okvira pri zadanom zumu. */
export function centered(natW: number, natH: number, zoom: number, boxW: number, boxH: number): Kadar {
  return { zoom, x: (boxW - natW * zoom) / 2, y: (boxH - natH * zoom) / 2 };
}

/**
 * Drži sliku tako da uvijek prekriva okvir. Samo za izrezivanje — kod logotipa
 * se ne primjenjuje, jer logo SMIJE biti manji od okvira.
 */
export function clampCover(
  next: { x: number; y: number },
  natW: number,
  natH: number,
  zoom: number,
  boxW: number,
  boxH: number
): { x: number; y: number } {
  return {
    x: Math.min(0, Math.max(boxW - natW * zoom, next.x)),
    y: Math.min(0, Math.max(boxH - natH * zoom, next.y)),
  };
}

/**
 * Drži logo tako da barem dio ostane u okviru.
 *
 * Bez ovoga se logo mogao odvući skroz van, a onda se sprema prazna slika i
 * nigdje nema traga zašto. Ne traži da bude cijeli unutra — namjerno, jer se
 * natpis ponekad kadrira tako da mu rub izađe.
 */
export function clampVisible(
  next: { x: number; y: number },
  natW: number,
  natH: number,
  zoom: number,
  boxW: number,
  boxH: number,
  minVidljivo = 0.25
): { x: number; y: number } {
  const w = natW * zoom;
  const h = natH * zoom;
  // Barem `minVidljivo` udjela logotipa (ili okvira, ako je logo manji).
  const dx = Math.min(w, boxW) * minVidljivo;
  const dy = Math.min(h, boxH) * minVidljivo;
  return {
    x: Math.min(boxW - dx, Math.max(dx - w, next.x)),
    y: Math.min(boxH - dy, Math.max(dy - h, next.y)),
  };
}

/** Novi pomak nakon zumiranja oko SREDINE okvira, a ne oko gornjeg lijevog kuta. */
export function zoomAroundCenter(
  off: { x: number; y: number },
  from: number,
  to: number,
  boxW: number,
  boxH: number
): { x: number; y: number } {
  const k = to / from;
  return { x: boxW / 2 - (boxW / 2 - off.x) * k, y: boxH / 2 - (boxH / 2 - off.y) * k };
}

export type Crtanje = { canvasW: number; canvasH: number; dx: number; dy: number; dw: number; dh: number };

/**
 * Gdje i koliko velika slika ide na izlazni canvas.
 *
 * Pregled je širok `FIT_W`, izlaz `size` — sve se množi istim brojem, pa je
 * ono što je organizator vidio točno ono što se sprema.
 */
export function fitDraw(natW: number, natH: number, kadar: Kadar, size: number): Crtanje {
  const s = size / FIT_W;
  return {
    canvasW: size,
    // Iz FIT_H, ne iz FIT_RATIO: dijeljenje omjerom daje drugi broj zbog
    // zaokruživanja, pa bi sredina izlaza odstupala od sredine pregleda.
    canvasH: Math.round(FIT_H * s),
    dx: kadar.x * s,
    dy: kadar.y * s,
    dw: natW * kadar.zoom * s,
    dh: natH * kadar.zoom * s,
  };
}

/**
 * Koliko se okvir logotipa smanji da stane u pločicu u aplikaciji.
 * Isto što `resizeMode="contain"` radi na uređaju — zato je pregled istinit.
 */
export function previewScale(boxW: number, boxH: number): number {
  return Math.min(boxW / FIT_W, boxH / FIT_H);
}
