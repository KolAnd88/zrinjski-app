// make-store-assets.mjs — materijali za Google Play, iz istih izvora kao aplikacija.
//
// Pokreni iz apps/mobile:   node scripts/make-store-assets.mjs
// Rezultat ide u:           apps/mobile/store/
//
// Zašto skripta, a ne grafički program: Google traži TOČNE dimenzije (512×512 i
// 1024×500), a ikona u trgovini mora biti ista kao ikona na uređaju. Kad se grb
// jednom promijeni, `make-icons.mjs` presloži aplikaciju, a ovo trgovinu — bez
// šanse da se to dvoje raziđe.
//
// Trebа @resvg/resvg-js, koji NIJE ovisnost projekta (koristi se jednom pred
// objavu). Instalira se privremeno:  npm i --no-save @resvg/resvg-js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(HERE, '..');
const REPO = path.resolve(MOBILE, '../..');
const OUT = path.join(MOBILE, 'store');

const C = {
  bg: '#0B0B0E',
  red: '#E11D2A',
  redDk: '#9C0C18',
  txt: '#F4F4F5',
  sub: '#9AA0AA',
  gold: '#D9B24A',
};

/** Lenta — iste vrijednosti kao packages/ui-tokens/src/lenta.ts. */
const LENTA = { angle: { wide: -30 }, band: 0.222, hairline: 0.008, gap: 0.022 };

/* ---------------------------------------------------------------- ikona 512 */

/**
 * Google traži 512×512. Aplikacijska ikona je 1024×512 predimenzionirana, pa se
 * smanjuje usrednjavanjem 2×2 bloka — smanjenje na točnu polovicu nema
 * problema s uzorkovanjem, svaki izlazni piksel pokriva točno četiri ulazna.
 */
function pola(src) {
  const out = new PNG({ width: src.width / 2, height: src.height / 2 });
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const o = (out.width * y + x) * 4;
      for (let k = 0; k < 4; k++) {
        const a = src.data[(src.width * (y * 2) + x * 2) * 4 + k];
        const b = src.data[(src.width * (y * 2) + x * 2 + 1) * 4 + k];
        const c = src.data[(src.width * (y * 2 + 1) + x * 2) * 4 + k];
        const d = src.data[(src.width * (y * 2 + 1) + x * 2 + 1) * 4 + k];
        out.data[o + k] = Math.round((a + b + c + d) / 4);
      }
    }
  }
  return out;
}

function ikona512() {
  const src = PNG.sync.read(fs.readFileSync(path.join(MOBILE, 'assets/icon.png')));
  if (src.width !== 1024) throw new Error(`icon.png je ${src.width}px, ocekivano 1024`);
  const out = pola(src);
  fs.writeFileSync(path.join(OUT, 'ikona-512.png'), PNG.sync.write(out));
  return `ikona-512.png  ${out.width}x${out.height}`;
}

/* ------------------------------------------------------- istaknuta grafika */

function fontovi() {
  // Oswald iz izvoza aplikacije — isti rez slova kao u samoj app-i.
  const baza = path.join(MOBILE, 'dist/assets/__node_modules/@expo-google-fonts');
  const nadi = (paket, uzorak) => {
    const dir = path.join(baza, paket, uzorak);
    const f = fs.readdirSync(dir).find((n) => n.endsWith('.ttf'));
    return path.join(dir, f);
  };
  return [nadi('oswald', '700Bold'), nadi('oswald', '500Medium'), nadi('inter', '500Medium')];
}

function grafika1024() {
  const W = 1024;
  const H = 500;
  const kut = LENTA.angle.wide;
  const baza = Math.min(W, H);
  const band = Math.round(baza * LENTA.band);
  const hair = Math.max(3, Math.round(baza * LENTA.hairline));
  const gap = Math.round(baza * LENTA.gap);
  const mid = Math.round(H * 0.5);
  const top = mid - Math.round(band / 2);
  const rad = (Math.abs(kut) * Math.PI) / 180;
  const len = W * Math.cos(rad) + H * Math.sin(rad) + 80;
  const x = W / 2 - len / 2;

  const grb = fs.readFileSync(path.join(MOBILE, 'assets/crest.png')).toString('base64');
  const GRB = 240;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.redDk}" stop-opacity="0"/>
      <stop offset="0.34" stop-color="${C.redDk}" stop-opacity="0.7"/>
      <stop offset="0.7" stop-color="${C.red}" stop-opacity="0.76"/>
      <stop offset="1" stop-color="${C.red}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="n" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.red}" stop-opacity="0"/>
      <stop offset="0.5" stop-color="${C.red}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${C.red}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${C.bg}"/>

  <g transform="rotate(${kut} ${W / 2} ${mid})">
    <rect x="${x}" y="${top - gap - hair}" width="${len}" height="${hair}" fill="url(#n)"/>
    <rect x="${x}" y="${top}" width="${len}" height="${band}" fill="url(#b)"/>
  </g>

  <image href="data:image/png;base64,${grb}" x="72" y="${(H - GRB) / 2}" width="${GRB}" height="${GRB}"/>

  <text x="360" y="212" font-family="Oswald" font-weight="700" font-size="72" fill="${C.txt}" letter-spacing="1">PONOS</text>
  <text x="360" y="288" font-family="Oswald" font-weight="700" font-size="72" fill="${C.txt}" letter-spacing="1">HERCEGOVINE</text>
  <text x="360" y="356" font-family="Oswald" font-weight="700" font-size="56" fill="${C.red}" letter-spacing="3">2026</text>
  <!-- Opis mora biti točan: PROJEKT.md kaže "rukometni turnir veterana", i
       ništa ne tvrdi da je međunarodni. U trgovini se ne izmišlja. -->
  <text x="366" y="404" font-family="Inter" font-weight="500" font-size="22" fill="${C.sub}" letter-spacing="3">RUKOMETNI TURNIR VETERANA · MOSTAR</text>
</svg>`;

  const { Resvg } = createRequireResvg();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { fontFiles: fontovi(), loadSystemFonts: false, defaultFontFamily: 'Oswald' },
  });
  const png = r.render().asPng();
  fs.writeFileSync(path.join(OUT, 'istaknuta-grafika-1024x500.png'), png);
  const p = PNG.sync.read(png);
  return `istaknuta-grafika-1024x500.png  ${p.width}x${p.height}`;
}

/** resvg se traži i izvan projekta, jer nije ovisnost repozitorija. */
function createRequireResvg() {
  const kandidati = [
    '@resvg/resvg-js',
    path.join(
      process.env.TEMP ?? '/tmp',
      'claude/C--Users-pc-Desktop-zrinjski-app/e821dda6-d794-4952-8551-cd2daab7c770/scratchpad/node_modules/@resvg/resvg-js'
    ),
  ];
  for (const k of kandidati) {
    try {
      return require(k);
    } catch {
      /* probaj sljedeći */
    }
  }
  throw new Error('Nema @resvg/resvg-js. Instaliraj: npm i --no-save @resvg/resvg-js');
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

fs.mkdirSync(OUT, { recursive: true });
console.log(ikona512());
console.log(grafika1024());
console.log(`\nSve u: ${path.relative(REPO, OUT)}`);
