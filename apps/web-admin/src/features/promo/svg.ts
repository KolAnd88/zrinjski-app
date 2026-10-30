// svg.ts — generatori SVG slika za promo (rezultat za mreže + QR plakat).
// Iste SVG nizove koristimo i za pregled (inline) i za preuzimanje (PNG/SVG).
import { colors, lentaSvg } from '@zrinjski/ui-tokens';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type ResultCardOpts = {
  homeName: string;
  homeCode: string;
  homeColor: string;
  awayName: string;
  awayCode: string;
  awayColor: string;
  homeScore: number;
  awayScore: number;
  stageLabel: string;
  tournamentName: string;
  sponsorName: string | null;
  isFinal: boolean;
};

/** Društvena slika rezultata (1200×630). Dijagonalna crvena lenta = potpis. */
export function resultCardSvg(o: ResultCardOpts): string {
  const W = 1200;
  const H = 630;
  const accent = o.isFinal ? colors.gold : colors.red;
  // Zlatna nit samo u finalu — isto pravilo kao za naslov iznad rezultata.
  const lenta = lentaSvg({ w: W, h: H, gold: o.isFinal, id: 'rc' });
  const crest = (x: number, code: string, color: string) => `
    <g transform="translate(${x},250)">
      <rect width="160" height="160" rx="24" fill="${color}"/>
      <text x="80" y="80" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
            font-size="56" text-anchor="middle" dominant-baseline="central">${esc(code)}</text>
    </g>`;
  const sponsorLine = o.sponsorName
    ? `<tspan> · pokrovitelj: </tspan><tspan fill="${colors.gold}">${esc(o.sponsorName)}</tspan>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${lenta.defs}</defs>
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  ${lenta.body}
  <text x="${W / 2}" y="110" fill="${accent}" font-family="Oswald, sans-serif" font-weight="700"
        font-size="34" letter-spacing="3" text-anchor="middle">${esc(o.stageLabel.toUpperCase())}</text>

  ${crest(140, o.homeCode, o.homeColor)}
  ${crest(W - 300, o.awayCode, o.awayColor)}

  <text x="${W / 2}" y="360" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="170" text-anchor="middle">${o.homeScore} : ${o.awayScore}</text>

  <text x="220" y="470" fill="#fff" font-family="Oswald, sans-serif" font-weight="600"
        font-size="40" text-anchor="middle">${esc(o.homeName.toUpperCase())}</text>
  <text x="${W - 220}" y="470" fill="#fff" font-family="Oswald, sans-serif" font-weight="600"
        font-size="40" text-anchor="middle">${esc(o.awayName.toUpperCase())}</text>

  <text x="${W / 2}" y="585" fill="${colors.sub}" font-family="Inter, sans-serif"
        font-size="26" text-anchor="middle">${esc(o.tournamentName)}${sponsorLine}</text>
</svg>`;
}

/** Jedan kod na plakatu — za koga je, što je i što se dogodi kad ga skenira. */
export type PosterCode = {
  qrDataUrl: string;
  /** Kome je namijenjen: "iPhone", "Android". */
  label: string;
  /** Što dobiva: "Web aplikacija", "Aplikacija s Google Playa". */
  kind: string;
  /** Dva kratka retka ispod koda. */
  hint: [string, string];
};

export type PosterOpts = {
  /** Jedan kod → centriran. Dva → jedan uz drugi. */
  codes: PosterCode[];
  tournamentName: string;
  /** Glavna poruka, npr. "PRATI TURNIR UŽIVO". */
  headline: string;
  /** Što se u aplikaciji nalazi, jednim retkom. */
  tagline: string;
  /** Savjet ispod kodova (iPhone: dodaj na početni zaslon). */
  tip?: string;
  /** Adresa za one koji ne skeniraju, npr. "ponoshercegovine.com". */
  footerUrl?: string;
  club?: string;
  /** Grb kao data URL — vanjska slika se u preuzetoj datoteci ne bi vidjela. */
  crestDataUrl?: string;
  /** @font-face pravila s ugrađenim fontovima, da preuzeta datoteka izgleda kao pregled. */
  fontCss?: string;
};

/**
 * QR plakat za ispis (800×1130, omjer A4).
 *
 * Dva koda jer put nije isti za sve: iPhone nema aplikaciju u trgovini pa
 * ide na web verziju, Android ide na Google Play. Jedan plakat s oba je bolji
 * od dva plakata — ljudi u dvorani gledaju jedno mjesto i biraju svoj.
 *
 * Na plakatu nema uputa organizatoru ("zalijepi po dvorani") — to stoji u
 * adminu, ne na papiru koji čitaju gledatelji.
 */
export function posterSvg(o: PosterOpts): string {
  const W = 800;
  const H = 1130;
  const codes = o.codes.filter((c) => !!c.qrDataUrl);
  const dvostruko = codes.length > 1;

  const CARD_W = 340;
  const CARD_H = 500;
  const TOP = 410;
  const TILE = 270;
  // Bijeli rub oko koda: čitači ga trebaju da razaznaju rubove.
  const QR = 240;
  const centri = dvostruko ? [W / 2 - 190, W / 2 + 190] : [W / 2];

  const kartica = (c: PosterCode, cx: number) => {
    const x = cx - CARD_W / 2;
    const tileY = TOP + 118;
    return `
  <rect x="${x}" y="${TOP}" width="${CARD_W}" height="${CARD_H}" rx="28" fill="${colors.card}" stroke="${colors.line}" stroke-width="2"/>
  <text x="${cx}" y="${TOP + 58}" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="38" letter-spacing="1" text-anchor="middle">${esc(c.label)}</text>
  <text x="${cx}" y="${TOP + 92}" fill="${colors.redLt}" font-family="Inter, sans-serif" font-weight="600"
        font-size="19" text-anchor="middle">${esc(c.kind)}</text>
  <rect x="${cx - TILE / 2}" y="${tileY}" width="${TILE}" height="${TILE}" rx="20" fill="#fff"/>
  <image x="${cx - QR / 2}" y="${tileY + (TILE - QR) / 2}" width="${QR}" height="${QR}" href="${c.qrDataUrl}"/>
  <text x="${cx}" y="${TOP + 432}" fill="${colors.txt2}" font-family="Inter, sans-serif"
        font-size="18" text-anchor="middle">${esc(c.hint[0])}</text>
  <text x="${cx}" y="${TOP + 460}" fill="${colors.txt2}" font-family="Inter, sans-serif"
        font-size="18" text-anchor="middle">${esc(c.hint[1])}</text>`;
  };

  // Lenta prolazi iza grba i naziva turnira pri vrhu plakata.
  const lenta = lentaSvg({ w: W, h: H, cy: 150 / H, id: 'pl' });
  const crest = o.crestDataUrl
    ? `<image x="${W / 2 - 56}" y="40" width="112" height="112" href="${o.crestDataUrl}" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  const naslovY = o.crestDataUrl ? 212 : 170;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${o.fontCss ? `<style>${o.fontCss}</style>` : ''}${lenta.defs}</defs>
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  ${lenta.body}
  ${crest}
  <text x="${W / 2}" y="${naslovY}" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="50" letter-spacing="1.5" text-anchor="middle">${esc(o.tournamentName.toUpperCase())}</text>
  <text x="${W / 2}" y="${naslovY + 42}" fill="${colors.txt2}" font-family="Inter, sans-serif"
        font-size="20" text-anchor="middle">${esc(o.tagline)}</text>

  <text x="${W / 2}" y="350" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="58" letter-spacing="2" text-anchor="middle">${esc(o.headline)}</text>
  <rect x="${W / 2 - 40}" y="370" width="80" height="5" rx="2.5" fill="${colors.red}"/>
${codes.map((c, i) => kartica(c, centri[i] ?? W / 2)).join('\n')}
  ${o.tip ? `<text x="${W / 2}" y="${TOP + CARD_H + 54}" fill="${colors.sub}" font-family="Inter, sans-serif"
        font-size="19" text-anchor="middle">${esc(o.tip)}</text>` : ''}
  ${o.footerUrl ? `<text x="${W / 2}" y="1046" fill="#fff" font-family="Oswald, sans-serif" font-weight="600"
        font-size="34" letter-spacing="1" text-anchor="middle">${esc(o.footerUrl)}</text>` : ''}
  ${o.club ? `<text x="${W / 2}" y="1084" fill="${colors.mut}" font-family="Inter, sans-serif"
        font-size="17" letter-spacing="2" text-anchor="middle">${esc(o.club.toUpperCase())}</text>` : ''}
</svg>`;
}

/** ArrayBuffer → base64, u komadima da veliki font ne prepuni stog. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/**
 * Fontovi plakata (Oswald, Inter) kao @font-face s ugrađenim datotekama.
 *
 * Admin ih učitava s Google Fonts, a preuzeta SVG datoteka ih nema: otvorena
 * u pregledniku ili poslana u tiskaru pala bi na Arial. Uzima se samo
 * latinica i proširena latinica (č, ć, đ, š, ž). Ne uspije li dohvat,
 * vraća prazno — plakat se preuzme s rezervnim fontom, umjesto da se ne
 * preuzme nikako.
 */
export async function posterFontCss(): Promise<string> {
  try {
    const css = await (
      await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Oswald:wght@600;700&display=swap')
    ).text();
    const blocks = css
      .split('/* ')
      .filter((b) => b.startsWith('latin */') || b.startsWith('latin-ext */'))
      .map((b) => b.slice(b.indexOf('*/') + 2));
    let out = '';
    for (const b of blocks) {
      const m = /url\((https:[^)]+)\)/.exec(b);
      if (!m) continue;
      const buf = await (await fetch(m[1]!)).arrayBuffer();
      out += b.replace(m[1]!, `data:font/woff2;base64,${toBase64(buf)}`);
    }
    return out;
  } catch {
    return '';
  }
}

/** Slika s iste domene kao data URL (grb za plakat); prazno ako ne uspije. */
export async function imageDataUrl(src: string): Promise<string> {
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => resolve('');
      r.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

/** Preuzmi SVG niz kao .svg datoteku. */
export function downloadSvg(svg: string, filename: string): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  triggerDownload(URL.createObjectURL(blob), filename);
}

/** Pretvori SVG u PNG (preko canvasa) i preuzmi. */
export function downloadSvgAsPng(svg: string, filename: string, w: number, h: number): void {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (png) triggerDownload(URL.createObjectURL(png), filename);
    }, 'image/png');
  };
  img.src = url;
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
