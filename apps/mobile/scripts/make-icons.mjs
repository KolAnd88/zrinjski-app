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

const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

// iOS + zadana ikona: MORA biti neprozirna, inače prozirno ispadne crno.
const icon = canvas(1024, WHITE);
const iconFit = fitted(src, box, 1024, 0.07);
draw(icon, iconFit.img, iconFit.x, iconFit.y);
write('icon.png', icon);

// Android adaptivna: sustav reže u krug/kvadrat po svom, pa grb mora stati u
// sigurnu sredinu (unutarnjih 66% promjera). Štit je viši nego širi, pa kad se
// uklopi po visini, vrhovi crvene krune završe u kutovima okvira — a kut je od
// središta dalje nego rub. Rub od 0.25 drži i njih unutar kruga.
const fg = canvas(512, CLEAR);
const fgFit = fitted(src, box, 512, 0.25);
draw(fg, fgFit.img, fgFit.x, fgFit.y);
write('android-icon-foreground.png', fg);

write('android-icon-background.png', canvas(512, WHITE));
write('android-icon-monochrome.png', monochrome(fg));

const fav = canvas(48, WHITE);
const favFit = fitted(src, box, 48, 0.04);
draw(fav, favFit.img, favFit.x, favFit.y);
write('favicon.png', fav);

// Ekran učitavanja: prozirna podloga, boju daje app.json.
const splash = canvas(1024, CLEAR);
const splashFit = fitted(src, box, 1024, 0.22);
draw(splash, splashFit.img, splashFit.x, splashFit.y);
write('splash-icon.png', splash);
