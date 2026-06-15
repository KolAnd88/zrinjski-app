// svg.ts — generatori SVG slika za promo (rezultat za mreže + QR plakat).
// Iste SVG nizove koristimo i za pregled (inline) i za preuzimanje (PNG/SVG).
import { colors } from '@zrinjski/ui-tokens';

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
  <defs>
    <linearGradient id="lenta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.redDk}"/>
      <stop offset="1" stop-color="${colors.red}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  <g transform="rotate(-12 ${W / 2} ${H / 2})" opacity="0.5">
    <rect x="-100" y="300" width="${W + 200}" height="150" fill="url(#lenta)"/>
  </g>
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

export type PosterOpts = {
  qrDataUrl: string;
  headline: string;
  sub: string;
  tournamentName: string;
};

/** QR plakat za ispis (800×1130, blizu A4). */
export function posterSvg(o: PosterOpts): string {
  const W = 800;
  const H = 1130;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="plenta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${colors.redDk}"/>
      <stop offset="1" stop-color="${colors.red}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${colors.bg}"/>
  <g transform="rotate(-12 ${W / 2} 220)" opacity="0.5">
    <rect x="-100" y="180" width="${W + 200}" height="120" fill="url(#plenta)"/>
  </g>
  <text x="${W / 2}" y="150" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="48" text-anchor="middle">${esc(o.tournamentName)}</text>

  <rect x="${(W - 460) / 2}" y="320" width="460" height="460" rx="24" fill="#fff"/>
  <image x="${(W - 420) / 2}" y="340" width="420" height="420" href="${o.qrDataUrl}"/>

  <text x="${W / 2}" y="880" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="46" text-anchor="middle">${esc(o.headline)}</text>
  <text x="${W / 2}" y="940" fill="${colors.sub}" font-family="Inter, sans-serif"
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
