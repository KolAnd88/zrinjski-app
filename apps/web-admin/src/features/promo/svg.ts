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

/** Jedan kod na plakatu — svoj naslov i svoje objašnjenje. */
export type PosterCode = {
  qrDataUrl: string;
  /** Kome je namijenjen: "iPhone", "Android". */
  label: string;
  /** Što se dogodi kad ga skenira. */
  hint: string;
};

export type PosterOpts = {
  /** Jedan kod → velik i centriran. Dva → jedan uz drugi. */
  codes: PosterCode[];
  headline: string;
  sub: string;
  tournamentName: string;
};

/**
 * QR plakat za ispis (800×1130, blizu A4).
 *
 * Dva koda jer put nije isti za sve: iPhone nema aplikaciju u trgovini pa ide
 * na web, Android skida APK. Jedan plakat s oba je bolji od dva plakata —
 * ljudi u dvorani gledaju jedno mjesto i biraju svoj.
 */
export function posterSvg(o: PosterOpts): string {
  const W = 800;
  const H = 1130;
  const codes = o.codes.filter((c) => !!c.qrDataUrl);
  const dvostruko = codes.length > 1;

  // Jedan kod ostaje velik kao i prije; dva se dijele u dva stupca.
  const CARD = dvostruko ? 330 : 460;
  // Bijeli rub oko koda: čitači ga trebaju da razaznaju rubove.
  const QR = CARD - 40;
  const TOP = dvostruko ? 360 : 320;
  const centri = dvostruko ? [W / 2 - 180, W / 2 + 180] : [W / 2];

  const blok = (c: PosterCode, cx: number) => `
  <text x="${cx}" y="${TOP - 28}" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="${dvostruko ? 30 : 34}" text-anchor="middle">${esc(c.label)}</text>
  <rect x="${cx - CARD / 2}" y="${TOP}" width="${CARD}" height="${CARD}" rx="24" fill="#fff"/>
  <image x="${cx - QR / 2}" y="${TOP + (CARD - QR) / 2}" width="${QR}" height="${QR}" href="${c.qrDataUrl}"/>
  <text x="${cx}" y="${TOP + CARD + 42}" fill="${colors.sub}" font-family="Inter, sans-serif"
        font-size="${dvostruko ? 22 : 26}" text-anchor="middle">${esc(c.hint)}</text>`;

  const dno = TOP + CARD + (dvostruko ? 110 : 100);
  // Lenta prolazi iza naziva turnira pri vrhu plakata.
  const lenta = lentaSvg({ w: W, h: H, cy: 195 / H, id: 'pl' });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${lenta.defs}</defs>
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  ${lenta.body}
  <text x="${W / 2}" y="150" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="48" text-anchor="middle">${esc(o.tournamentName)}</text>
${codes.map((c, i) => blok(c, centri[i] ?? W / 2)).join('\n')}
  <text x="${W / 2}" y="${dno}" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="${dvostruko ? 40 : 46}" text-anchor="middle">${esc(o.headline)}</text>
  <text x="${W / 2}" y="${dno + 56}" fill="${colors.sub}" font-family="Inter, sans-serif"
        font-size="28" text-anchor="middle">${esc(o.sub)}</text>
</svg>`;
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
