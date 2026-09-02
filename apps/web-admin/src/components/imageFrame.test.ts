import { describe, expect, it } from 'vitest';
import {
  centered,
  clampCover,
  clampVisible,
  coverZoom,
  FIT_H,
  FIT_RATIO,
  FIT_W,
  fitDraw,
  fitZoom,
  previewScale,
  zoomAroundCenter,
} from './imageFrame';

/**
 * Unutarnje mjere pločica u aplikaciji (veličina minus razmak), prepisane iz
 * `apps/mobile/src/components/home.tsx` — MARQUEE_SIZE.
 */
const PLOCICE = [
  // sirina: minus 2x6 razmaka i 2x1 ruba; visina: minus 2x5 i 2x1
  { ime: 'zlatna', w: 186 - 14, h: 88 - 12 },
  { ime: 'srebrna', w: 163 - 14, h: 78 - 12 },
  { ime: 'partner', w: 122 - 14, h: 52 - 12 },
] as const;

describe('okvir logotipa', () => {
  it('omjer je izveden iz okvira, pa se ne može raziću s njim', () => {
    expect(FIT_RATIO).toBe(FIT_W / FIT_H);
  });

  // Ovo je uvjet ujednačenosti: ako je okvir u svakoj pločici ograničen
  // VISINOM, svaki logo dobiva jednaku visinu bez obzira na oblik. Ako bi
  // igdje bio ograničen širinom, ta bi pločica odskakala.
  it('u SVAKOJ pločici ograničava ga visina, ne širina', () => {
    for (const p of PLOCICE) {
      expect(FIT_W / FIT_H, `${p.ime} je uža od okvira`).toBeLessThanOrEqual(p.w / p.h);
    }
  });
});

describe('fitZoom', () => {
  it('širok logo ograničava širina okvira', () => {
    // 600×100 → širina je uže grlo: 300/600 = 0.5 (logo ide do ruba okvira)
    expect(fitZoom(600, 100, FIT_W, FIT_H)).toBeCloseTo(0.5, 5);
  });

  it('visok logo ograničava visina okvira', () => {
    expect(fitZoom(100, 600, FIT_W, FIT_H)).toBeCloseTo(FIT_H / 600, 5);
  });

  it('cijeli logo uvijek stane, s rubom', () => {
    for (const [w, h] of [[600, 100], [100, 600], [400, 400], [1200, 50]] as const) {
      const z = fitZoom(w, h, FIT_W, FIT_H);
      expect(w * z).toBeLessThanOrEqual(FIT_W + 0.001);
      expect(h * z).toBeLessThanOrEqual(FIT_H + 0.001);
    }
  });
});

describe('centered', () => {
  it('stavlja sliku u sredinu okvira', () => {
    const z = fitZoom(600, 100, FIT_W, FIT_H);
    const k = centered(600, 100, z, FIT_W, FIT_H);
    // Jednak razmak lijevo i desno, gore i dolje.
    expect(k.x).toBeCloseTo((FIT_W - 600 * z) / 2, 5);
    expect(FIT_W - (k.x + 600 * z)).toBeCloseTo(k.x, 5);
    expect(FIT_H - (k.y + 100 * z)).toBeCloseTo(k.y, 5);
  });
});

describe('fitDraw — pregled i izlaz moraju se poklapati', () => {
  // Ovo je srž: organizator namjesti kadar na pregledu od 300 px, a sprema se
  // na 800 px. Ako se omjer razmimoiđe, dobije nešto drugo nego što je vidio.
  it('izlaz drži omjer okvira u zadanoj širini', () => {
    const z = fitZoom(600, 100, FIT_W, FIT_H);
    const d = fitDraw(600, 100, centered(600, 100, z, FIT_W, FIT_H), 900);
    expect(d.canvasW).toBe(900);
    expect(d.canvasW / d.canvasH).toBeCloseTo(FIT_RATIO, 2);
  });

  it('položaj i veličina rastu istim brojem kao okvir', () => {
    const z = fitZoom(600, 100, FIT_W, FIT_H);
    const k = centered(600, 100, z, FIT_W, FIT_H);
    const d = fitDraw(600, 100, k, 900);
    const s = 900 / FIT_W;
    expect(d.dx).toBeCloseTo(k.x * s, 5);
    expect(d.dw).toBeCloseTo(600 * z * s, 5);
  });

  // Visina platna se zaokružuje na cijeli piksel (800/1.5 = 533.33), pa sredina
  // može odstupiti za djelić piksela. Jamstvo je "unutar pola piksela", ne
  // matematička točnost — a za veličinu koja se stvarno koristi (900) je točna.
  it('sredina ostaje sredina, unutar pola piksela', () => {
    const z = fitZoom(400, 400, FIT_W, FIT_H);
    const k = centered(400, 400, z, FIT_W, FIT_H);
    for (const size of [800, 900, 1024]) {
      const d = fitDraw(400, 400, k, size);
      expect(Math.abs(d.dx + d.dw / 2 - d.canvasW / 2)).toBeLessThan(0.5);
      expect(Math.abs(d.dy + d.dh / 2 - d.canvasH / 2)).toBeLessThan(0.5);
    }
  });

  it('pri 900 px visina izlazi bez zaokruživanja', () => {
    const z = fitZoom(400, 400, FIT_W, FIT_H);
    const d = fitDraw(400, 400, centered(400, 400, z, FIT_W, FIT_H), 900);
    expect(d.canvasH).toBe((900 * FIT_H) / FIT_W);
    expect(d.dy + d.dh / 2).toBeCloseTo(d.canvasH / 2, 6);
  });

  it('pomak ulijevo ostaje ulijevo', () => {
    const z = fitZoom(400, 400, FIT_W, FIT_H);
    const k = { ...centered(400, 400, z, FIT_W, FIT_H), x: 0 };
    expect(fitDraw(400, 400, k, 800).dx).toBe(0);
  });
});

describe('previewScale — pregled mora lagati manje od oka', () => {
  it('u svakoj pločici mjeri po visini', () => {
    for (const p of PLOCICE) {
      expect(previewScale(p.w, p.h), p.ime).toBeCloseTo(p.h / FIT_H, 5);
    }
  });

  it('okvir nikad ne prelazi pločicu', () => {
    for (const p of PLOCICE) {
      const s = previewScale(p.w, p.h);
      expect(FIT_W * s).toBeLessThanOrEqual(p.w + 0.001);
      expect(FIT_H * s).toBeLessThanOrEqual(p.h + 0.001);
    }
  });

  // Ovo je mjerljiva definicija "ujednačeno": ma kakav bio izvorni logo,
  // nikad ne prelazi isti okvir — pa nijedan ne odskače od ostalih.
  const OBLICI = [
    [600, 100],
    [400, 400],
    [100, 600],
    [1200, 200],
    [50, 50],
  ] as const;

  it('nijedan oblik logotipa ne prelazi okvir', () => {
    for (const p of PLOCICE) {
      const s = previewScale(p.w, p.h);
      for (const [w, h] of OBLICI) {
        const z = fitZoom(w, h, FIT_W, FIT_H);
        expect(w * z * s, `${p.ime} ${w}x${h} širina`).toBeLessThanOrEqual(FIT_W * s + 0.001);
        expect(h * z * s, `${p.ime} ${w}x${h} visina`).toBeLessThanOrEqual(FIT_H * s + 0.001);
      }
    }
  });

  // Sve što nije šire od okvira dosegne TOČNO istu visinu — kvadrat, visoki
  // logo i blago široki stoje jednako visoko, sto je ono sto oko primijeti.
  it('logotipi koje ograničava visina dosežu istu visinu', () => {
    const visine = [
      [400, 400],
      [100, 600],
      [300, 400],
      [50, 50],
    ].map(([w, h]) => +(h! * fitZoom(w!, h!, FIT_W, FIT_H)).toFixed(6));
    expect(new Set(visine).size).toBe(1);
    expect(visine[0]).toBeCloseTo(FIT_H, 5);
  });
});

describe('izrezivanje grba (nepromijenjeno ponašanje)', () => {
  it('coverZoom prekriva okvir', () => {
    const z = coverZoom(600, 100, 300, 300);
    expect(600 * z).toBeGreaterThanOrEqual(300);
    expect(100 * z).toBeGreaterThanOrEqual(300);
  });

  it('clampCover ne pušta praznu traku', () => {
    const z = coverZoom(600, 300, 300, 300);
    const c = clampCover({ x: 500, y: -9999 }, 600, 300, z, 300, 300);
    expect(c.x).toBeLessThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(300 - 300 * z);
  });
});

describe('clampVisible — logo se ne smije odvući skroz van', () => {
  const NAT = { w: 600, h: 100 };
  const z = 0.5; // fitZoom za 600×100

  it('vraća logo koji je odvučen daleko desno', () => {
    const c = clampVisible({ x: 99999, y: 0 }, NAT.w, NAT.h, z, FIT_W, FIT_H);
    expect(c.x).toBeLessThanOrEqual(FIT_W);
    // Barem četvrtina logotipa mora ostati u okviru.
    expect(FIT_W - c.x).toBeGreaterThanOrEqual(NAT.w * z * 0.25 - 0.001);
  });

  it('vraća logo koji je odvučen daleko lijevo', () => {
    const c = clampVisible({ x: -99999, y: 0 }, NAT.w, NAT.h, z, FIT_W, FIT_H);
    expect(c.x + NAT.w * z).toBeGreaterThanOrEqual(NAT.w * z * 0.25 - 0.001);
  });

  it('ne dira kadar koji je već unutra', () => {
    const dobar = { x: 50, y: 30 };
    expect(clampVisible(dobar, NAT.w, NAT.h, z, FIT_W, FIT_H)).toEqual(dobar);
  });

  it('radi i kad je logo veći od okvira', () => {
    const c = clampVisible({ x: 99999, y: 99999 }, 600, 100, 2, FIT_W, FIT_H);
    expect(c.x).toBeLessThanOrEqual(FIT_W);
    expect(c.y).toBeLessThanOrEqual(FIT_H);
  });
});

describe('zoomAroundCenter', () => {
  it('sredina okvira ostaje na istom mjestu slike', () => {
    const off = { x: -50, y: -20 };
    const next = zoomAroundCenter(off, 1, 2, FIT_W, FIT_H);
    // Točka slike koja je bila u sredini okvira mora ondje i ostati.
    const prije = (FIT_W / 2 - off.x) / 1;
    const poslije = (FIT_W / 2 - next.x) / 2;
    expect(poslije).toBeCloseTo(prije, 5);
  });
});
