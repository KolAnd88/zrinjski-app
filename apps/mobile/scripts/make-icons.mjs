// make-icons.mjs — iz jednog grba napravi sve ikone koje Expo traži.
//
// Pokreni iz apps/mobile:   node scripts/make-icons.mjs assets/source/grb.png
//
// Zašto skripta, a ne ručno u Photoshopu: svaka platforma traži drugu veličinu
// i drugo ponašanje prozirnosti, a Android još reže ikonu u krug. Kad se grb
// jednom promijeni, ovo ga preračuna svuda i nitko ne zaboravi jednu datoteku.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const SRC = process.argv[2] ?? 'assets/source/grb.png';
const OUT = 'assets';

/** Piksel je "pozadina" ako je gotovo bijel — tako nađemo pravi rub grba. */
const NEAR_WHITE = 12;

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

/** Okvir oko sadržaja: bijeli obrub izvorne slike nas ne zanima. */
function contentBox(img) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (img.width * y + x) * 4;
      const [r, g, b, a] = [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
      const isBg = a < 16 || (255 - r < NEAR_WHITE && 255 - g < NEAR_WHITE && 255 - b < NEAR_WHITE);
      if (isBg) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? { x: 0, y: 0, w: img.width, h: img.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function sample(img, x, y) {
  const cx = Math.max(0, Math.min(img.width - 1, x));
  const cy = Math.max(0, Math.min(img.height - 1, y));
  const i = (img.width * cy + cx) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

/**
 * Prebaci pravokutnik izvora u odredište, uprosječujući po površini.
 * Kod smanjivanja to je jedini način da sitni tekst ("VETERANI HRVATSKOG…")
 * ne postane šum; kod povećavanja ispadne bilinearno, što je ovdje dovoljno.
 */
function resample(img, box, dw, dh) {
  const out = new PNG({ width: dw, height: dh });
  const sx = box.w / dw;
  const sy = box.h / dh;
  for (let y = 0; y < dh; y++) {
    const fy0 = box.y + y * sy;
    const fy1 = fy0 + sy;
    for (let x = 0; x < dw; x++) {
      const fx0 = box.x + x * sx;
      const fx1 = fx0 + sx;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const px0 = Math.floor(fx0), px1 = Math.max(px0 + 1, Math.ceil(fx1));
      const py0 = Math.floor(fy0), py1 = Math.max(py0 + 1, Math.ceil(fy1));
      for (let py = py0; py < py1; py++) {
        for (let px = px0; px < px1; px++) {
          const [pr, pg, pb, pa] = sample(img, px, py);
          r += pr; g += pg; b += pb; a += pa; n++;
        }
      }
      const i = (dw * y + x) * 4;
      out.data[i] = Math.round(r / n);
      out.data[i + 1] = Math.round(g / n);
      out.data[i + 2] = Math.round(b / n);
      out.data[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

/** Prazno platno zadane boje (alpha 0 = prozirno). */
function canvas(size, [r, g, b, a]) {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a;
  }
  return png;
}

/** Nacrtaj sliku na platno, s alpha stapanjem. */
function draw(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const dx = ox + x, dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      const si = (src.width * y + x) * 4;
      const di = (dst.width * dy + dx) * 4;
      const sa = src.data[si + 3] / 255;
      if (sa === 0) continue;
      for (let c = 0; c < 3; c++) {
        dst.data[di + c] = Math.round(src.data[si + c] * sa + dst.data[di + c] * (1 - sa));
      }
      dst.data[di + 3] = Math.max(dst.data[di + 3], src.data[si + 3]);
    }
  }
}

/**
 * Grb uklopljen u kvadrat zadane veličine, uz zadani udio praznog ruba.
 * Omjer stranica se čuva — štit je viši nego širi i ne smije se rastegnuti.
 */
function fitted(img, box, size, inset) {
  const target = Math.round(size * (1 - inset * 2));
  const scale = Math.min(target / box.w, target / box.h);
  const w = Math.max(1, Math.round(box.w * scale));
  const h = Math.max(1, Math.round(box.h * scale));
  return { img: resample(img, box, w, h), x: Math.round((size - w) / 2), y: Math.round((size - h) / 2) };
}

/**
 * Ukloni bijelu pozadinu OKO grba, ali ne i bijelo unutar njega.
 *
 * Zato poplavno bojenje s rubova platna umjesto "izbaci sve bijelo": lovorove
 * grančice i natpis u grbu su bijeli i moraju ostati. Uklanja se samo bijelo
 * koje je povezano s vanjskim rubom.
 */
function cutout(img, tolerance = 26) {
  const n = img.width * img.height;
  const bg = new Uint8Array(n);
  const isWhite = (i) => {
    const d = i * 4;
    return (
      img.data[d + 3] === 0 ||
      (255 - img.data[d] < tolerance && 255 - img.data[d + 1] < tolerance && 255 - img.data[d + 2] < tolerance)
    );
  };

  const queue = [];
  for (let x = 0; x < img.width; x++) {
    queue.push(x, (img.height - 1) * img.width + x);
  }
  for (let y = 0; y < img.height; y++) {
    queue.push(y * img.width, y * img.width + img.width - 1);
  }

  while (queue.length) {
    const i = queue.pop();
    if (bg[i] || !isWhite(i)) continue;
    bg[i] = 1;
    const x = i % img.width;
    const y = (i - x) / img.width;
    if (x > 0) queue.push(i - 1);
    if (x < img.width - 1) queue.push(i + 1);
    if (y > 0) queue.push(i - img.width);
    if (y < img.height - 1) queue.push(i + img.width);
  }

  const out = new PNG({ width: img.width, height: img.height });
  img.data.copy(out.data);
  for (let i = 0; i < n; i++) if (bg[i]) out.data[i * 4 + 3] = 0;
  return out;
}

/** Bijela silueta na prozirnom — Android 13+ "temirane" ikone. */
function monochrome(layer) {
  const out = new PNG({ width: layer.width, height: layer.height });
  for (let i = 0; i < layer.data.length; i += 4) {
    const [r, g, b, a] = [layer.data[i], layer.data[i + 1], layer.data[i + 2], layer.data[i + 3]];
    // Bjelina se gubi (to je pozadina grba), a sve što ima boju postaje puno.
    const ink = a === 0 ? 0 : 255 - Math.min(r, g, b);
    out.data[i] = 255; out.data[i + 1] = 255; out.data[i + 2] = 255;
    out.data[i + 3] = Math.min(255, Math.round(ink * 1.6));
  }
  return out;
}

function write(file, png) {
  const p = path.join(OUT, file);
  fs.writeFileSync(p, PNG.sync.write(png));
  console.log(`${file.padEnd(32)} ${png.width}x${png.height}  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
}

// ── Izvedba ────────────────────────────────────────────────────────────────
const src = readPng(SRC);
const box = contentBox(src);
console.log(`izvor: ${src.width}x${src.height}, grb u okviru ${box.w}x${box.h} @ ${box.x},${box.y}\n`);

const CLEAR = [0, 0, 0, 0];
/**
 * Pozadina ikone je TAMNA, boja aplikacije — ne bijela.
 *
 * Ranije je bila bijela, pa je ikona na zaslonu telefona bila bijeli kvadratić
 * s malim grbom u sredini. Grb se pritom ne može bitno povećati: mjereno,
 * najdalji obojani piksel je na 0.632 visine grba, pa unutar sigurnog kruga
 * (unutarnjih 66% promjera) stane najviše 270 od 512 px visine. Bjelina nije
 * dolazila od veličine grba nego od podloge.
 */
const BG = [11, 11, 14, 255];

/**
 * Grb BEZ bijele podloge oko sebe.
 *
 * Izvorna slika ima bijelu pozadinu unutar svog okvira. Dok je i ikona bila
 * bijela to se nije vidjelo, ali na tamnoj podlozi bi ispao bijeli pravokutnik
 * oko štita. `cutout` miče samo bijelo POVEZANO S RUBOM, pa lovor i natpis
 * unutar grba ostaju.
 */
function znak(size, inset) {
  const f = fitted(src, box, size, inset);
  return { img: cutout(f.img), x: f.x, y: f.y };
}

// iOS + zadana ikona: MORA biti neprozirna, inače prozirno ispadne crno.
// Ovdje nema maske osim zaobljenih kutova, pa grb ide gotovo do ruba.
const icon = canvas(1024, BG);
const iconFit = znak(1024, 0.04);
draw(icon, iconFit.img, iconFit.x, iconFit.y);
write('icon.png', icon);

/**
 * Android adaptivna ikona.
 *
 * Sustav reže sloj u oblik po svom izboru. Izmjereno koliko grba preživi:
 *
 *   visina   okrugla maska   zaobljena maska
 *     270        100.0%           100.0%
 *     348         98.5%           100.0%
 *     389         90.8%           100.0%
 *     430         80.2%           100.0%   ← ovdje smo
 *     461         71.7%           100.0%
 *
 * Zaobljena maska pokazuje cijeli grb pri svakoj veličini — štit staje u nju i
 * kad je gotovo preko cijelog sloja. Tako crtaju Samsung, Xiaomi i većina
 * ostalih, pa i telefoni na kojima će turnir stvarno gledati.
 *
 * Googleov zajamčeni krug od 72dp reže i pri 430 gubi 20% — vrh krune i donji
 * šiljak štita. Isprobano je i 461: na zaobljenoj maski grb dodiruje rub i
 * ikona djeluje pretijesno, pa je vraćeno na 430.
 * Ako zatreba manje: 0.12 daje 389 (gubi 9%), 0.16 daje 348 (gubi 1.5%).
 */
const fg = canvas(512, CLEAR);
const fgFit = znak(512, 0.08);
draw(fg, fgFit.img, fgFit.x, fgFit.y);
write('android-icon-foreground.png', fg);

write('android-icon-background.png', canvas(512, BG));
write('android-icon-monochrome.png', monochrome(fg));

const fav = canvas(48, BG);
const favFit = znak(48, 0.04);
draw(fav, favFit.img, favFit.x, favFit.y);
write('favicon.png', fav);

// Grb za zaglavlje u aplikaciji: izrezan iz bijele pozadine i tijesno obrezan,
// jer stoji uz naziv turnira na tamnoj podlozi.
const crest = canvas(256, CLEAR);
const crestFit = fitted(src, box, 256, 0.02);
draw(crest, cutout(crestFit.img), crestFit.x, crestFit.y);
write('crest.png', crest);

// Ekran učitavanja stoji na tamnoj boji aplikacije, pa grb mora biti izrezan
// iz bijele pozadine — inače se vidi bijeli pravokutnik oko štita.
const splash = canvas(1024, CLEAR);
const splashFit = fitted(src, box, 1024, 0.22);
draw(splash, cutout(splashFit.img), splashFit.x, splashFit.y);
write('splash-icon.png', splash);
