// imageFrame.ts — računica kadra za uređivač slika.
//
// Izdvojeno iz komponente jer je ovdje jedina stvar koja stvarno može ispasti
// kriva: preslikavanje između PREGLEDA (300 px širine) i IZLAZA (800 px), te
// između okvira 3:2 i pločica u aplikaciji. Ako se ta dva razmimoiđu,
// organizator namjesti jedno a dobije drugo — a to se na oko ne primijeti dok
// logo ne završi u aplikaciji.

/**
 * Okvir logotipa je isti za SVE sponzore — otud ujednačen izgled.
 *
 * Omjer 2.4 nije proizvoljan. Pločice u aplikaciji imaju unutarnje omjere
 * 4.06 (zlatna), 2.42 (srebrna/brončana) i 3.06 (partner). Okvir uži od
 * najužeg od njih ograničen je VISINOM u svima — pa svaki logo dobije jednaku
 * visinu, bez obzira na oblik. To je ono što se vidi kao ujednačenost.
 *
 * Ići uže (npr. 3:2) ne bi pokvarilo ujednačenost, ali bi široke natpise
 * bespotrebno smanjilo: u zlatnoj kartici zauzeli bi 102 od 276 px širine
 * umjesto 163.
 */
export const FIT_RATIO = 2.4;
export const FIT_W = 300;
export const FIT_H = Math.round(FIT_W / FIT_RATIO);

/** Rub koji logo dobiva pri automatskom uklapanju (8% sa svake strane). */
const PAD = 0.84;

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
    canvasH: Math.round(size / FIT_RATIO),
    dx: kadar.x * s,
    dy: kadar.y * s,
    dw: natW * kadar.zoom * s,
    dh: natH * kadar.zoom * s,
  };
}

/**
 * Koliko se okvir 3:2 smanji da stane u pločicu u aplikaciji.
 * Isto što `resizeMode="contain"` radi na uređaju — zato je pregled istinit.
 */
export function previewScale(boxW: number, boxH: number): number {
  return Math.min(boxW / FIT_W, boxH / FIT_H);
}
