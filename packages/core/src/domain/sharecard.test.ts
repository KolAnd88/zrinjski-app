import { describe, expect, it } from 'vitest';
import {
  SHARE_STRIP_H,
  SHARE_STRIP_W,
  shareCardSvg,
  sponsorStripBody,
  sponsorStripSvg,
  type ShareCardOpts,
  type ShareSponsor,
} from './sharecard';

const base: ShareCardOpts = {
  home: { name: 'VHMRK Zrinjski', code: 'ZRI', crestIndex: 0, score: 5 },
  away: { name: 'Posušje veterani', code: 'POS', crestIndex: 4, score: 2 },
  stageLabel: 'Grupa A',
  dateLabel: '6.6.2026.',
  tournamentName: 'Ponos Hercegovine 2026',
};

/** Sve x/width vrijednosti u SVG-u — za provjeru da ništa ne curi izvan slike. */
function numbersOf(svg: string, attr: string): number[] {
  return [...svg.matchAll(new RegExp(`${attr}="(-?[\\d.]+)"`, 'g'))].map((m) => Number(m[1]));
}

describe('shareCardSvg — okvir', () => {
  it('uvijek je 1080×1350 (4:5, prolazi i na Instagramu i na Facebooku)', () => {
    const svg = shareCardSvg(base);
    expect(svg).toContain('width="1080"');
    expect(svg).toContain('height="1350"');
    expect(svg).toContain('viewBox="0 0 1080 1350"');
  });

  it('rezultat je najveći tekst na slici', () => {
    const sizes = numbersOf(shareCardSvg(base), 'font-size');
    expect(Math.max(...sizes)).toBe(230);
  });
});

describe('shareCardSvg — naziv turnira', () => {
  it('ispisuje se cijel, bez skraćivanja', () => {
    expect(shareCardSvg(base)).toContain('PONOS HERCEGOVINE 2026');
  });

  it('dugačak naziv smanjuje slova umjesto da se reže', () => {
    const dug = shareCardSvg({
      ...base,
      tournamentName: 'Međunarodni veteranski rukometni turnir Hercegovine',
    });
    expect(dug).toContain('MEĐUNARODNI VETERANSKI RUKOMETNI TURNIR HERCEGOVINE');
    expect(dug).not.toContain('…');

    // Slova moraju biti manja nego kod kratkog naziva.
    const kratkiSize = /font-size="(\d+)" letter-spacing="2"/.exec(shareCardSvg(base))![1];
    const dugiSize = /font-size="(\d+)" letter-spacing="2"/.exec(dug)![1];
    expect(Number(dugiSize)).toBeLessThan(Number(kratkiSize));
    expect(Number(dugiSize)).toBeGreaterThanOrEqual(26);
  });

  it('znakovi koji bi razbili XML se propuštaju kroz escape', () => {
    const svg = shareCardSvg({ ...base, tournamentName: 'Kup <A & B> "2026"' });
    expect(svg).toContain('&lt;A &amp; B&gt;');
    expect(svg).not.toMatch(/<A &/);
  });
});

describe('shareCardSvg — ekipe i ishod', () => {
  it('gubitnikov naziv je prigušen, pobjednikov bijel', () => {
    const svg = shareCardSvg(base);
    expect(svg).toMatch(/fill="#FFFFFF"[^>]*>VHMRK ZRINJSKI/);
    expect(svg).toMatch(/fill="#6B7079"[^>]*>POSUŠJE VETERANI/);
  });

  it('kod neriješenog nitko nije prigušen', () => {
    const svg = shareCardSvg({
      ...base,
      home: { ...base.home, score: 3 },
      away: { ...base.away, score: 3 },
    });
    expect(svg).not.toContain('#6B7079">');
    expect(svg).toMatch(/fill="#FFFFFF"[^>]*>POSUŠJE VETERANI/);
  });

  it('dugo ime ekipe se reže, jer bi inače izašlo iz stupca', () => {
    const svg = shareCardSvg({
      ...base,
      home: { ...base.home, name: 'Veterani rukometnog kluba Hercegovina' },
    });
    expect(svg).toContain('…');
  });

  it('bez kratice grb uzima prva tri slova prve rijeci', () => {
    expect(shareCardSvg({ ...base, home: { ...base.home, code: null } })).toContain('>VHM<');
    expect(
      shareCardSvg({ ...base, home: { ...base.home, name: 'Grude Legende', code: null } })
    ).toContain('>GRU<');
  });

  it('kratka prva rijec se dopunjava sljedecom', () => {
    const svg = shareCardSvg({ ...base, home: { ...base.home, name: 'AS Mostar', code: null } });
    expect(svg).toContain('>ASM<');
  });

  it('finale nosi zlatnu, obična utakmica crvenu', () => {
    expect(shareCardSvg({ ...base, isFinal: true })).toContain('url(#gold)"/>');
    expect(shareCardSvg(base)).toContain('url(#hdr)"/>');
  });
});

describe('shareCardSvg — strijelci', () => {
  const sa = {
    ...base,
    scorers: {
      home: [
        { name: 'Marko Jurić', goals: 3 },
        { name: 'Ivan Babić', goals: 2 },
      ],
      away: [{ name: 'Slaven Boban', goals: 2 }],
    },
  };

  it('svaka ekipa ima svoj stupac, poravnat s grbom', () => {
    const svg = shareCardSvg(sa);
    expect(svg).toMatch(/x="250"[^>]*>Marko Jurić/);
    expect(svg).toMatch(/x="830"[^>]*>Slaven Boban/);
  });

  it('ekipa bez strijelca dobiva crticu, ne prazninu', () => {
    const svg = shareCardSvg({ ...sa, scorers: { home: sa.scorers.home, away: [] } });
    expect(svg).toMatch(/x="830"[^>]*>—</);
  });

  it('navodi SVE strijelce, ne samo prve', () => {
    const svg = shareCardSvg({
      ...sa,
      scorers: {
        home: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ name: `Igrac ${n}`, goals: 1 })),
        away: [],
      },
    });
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(svg).toContain(`Igrac ${n}`);
  });

  // Traka sponzora počinje crtom na 992. Popis strijelaca se skuplja da stane
  // iznad — inače bi im pisao preko logotipa.
  const lastScorerY = (svg: string) => {
    const ys = [...svg.matchAll(/<text x="250" y="(\d+)"[^>]*>Igrac /g)].map((m) => Number(m[1]));
    return Math.max(...ys);
  };

  it.each([4, 6, 8, 10, 14])('popis od %i strijelaca ne ulazi u sponzore', (n) => {
    const svg = shareCardSvg({
      ...sa,
      scorers: {
        home: Array.from({ length: n }, (_, i) => ({ name: `Igrac ${i + 1}`, goals: 1 })),
        away: [],
      },
    });
    expect(lastScorerY(svg)).toBeLessThan(992);
  });

  it('kod uobičajena tri strijelca raspored ostaje nepromijenjen', () => {
    const svg = shareCardSvg(sa);
    // Prvi redak na 826 uz puna slova (26).
    expect(svg).toMatch(/y="826"[^>]*font-size="26"/);
  });

  // Jedan stupac s deset imena pao bi na 13 px i ne bi se pročitao na telefonu.
  it('dug popis se lomi u dva pod-stupca umjesto da slova postanu sitna', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `Igrac ${i + 1}`, goals: 1 }));
    const scorerFonts = (svg: string) =>
      [...svg.matchAll(/<text x="(-?\d+)" y="(\d+)"[^>]*?font-size="(\d+)"[^>]*>[^<]*<tspan/gs)]
        .map((m) => ({ x: Number(m[1]), y: Number(m[2]), fs: Number(m[3]) }))
        .filter((r) => r.y > 760);

    const rows = scorerFonts(shareCardSvg({ ...sa, scorers: { home: many(10), away: [] } }));
    expect(rows).toHaveLength(10);
    // Dva različita x-a za istu ekipu = dva pod-stupca.
    expect(new Set(rows.map((r) => r.x)).size).toBe(2);
    // I dalje čitko: slova ne smiju pasti ispod 18 px.
    expect(Math.min(...rows.map((r) => r.fs))).toBeGreaterThanOrEqual(18);
  });

  it('igrači bez golova se ne navode', () => {
    const svg = shareCardSvg({
      ...sa,
      scorers: { home: [{ name: 'Bez gola', goals: 0 }], away: [] },
    });
    expect(svg).not.toContain('Bez gola');
  });

  it('bez ijednog strijelca blok se ne crta', () => {
    expect(shareCardSvg(base)).not.toContain('STRIJELCI');
  });
});

describe('shareCardSvg — grbovi', () => {
  const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

  it('ekipa s grbom dobiva svoj grb, a ne znak s kraticom', () => {
    const svg = shareCardSvg({ ...base, home: { ...base.home, logo: LOGO } });
    expect(svg).toContain(`href="${LOGO}"`);
    expect(svg).not.toContain('>ZRI<');
    // Druga ekipa nema grb — ona i dalje ima znak.
    expect(svg).toContain('>POS<');
  });
});

describe('sponzori', () => {
  const s = (name: string, tier: ShareSponsor['tier'], logo?: string): ShareSponsor => ({
    name,
    tier,
    logo: logo ?? null,
  });
  const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
  const STRIP = 'data:image/jpeg;base64,/9j/4AAQ';

  /** Pravi turnir: 10 zlatnih, 7 srebrnih, 1 partner. */
  const turnir = [
    ...Array.from({ length: 10 }, (_, i) => s(`Zlatni ${i + 1}`, 'gold')),
    ...Array.from({ length: 7 }, (_, i) => s(`Srebrni ${i + 1}`, 'silver')),
    s('Partner', 'partner'),
  ];

  it('unaprijed složena traka ide u sliku kao JEDNA slika', () => {
    const svg = shareCardSvg({ ...base, sponsorStrip: STRIP, sponsors: turnir });
    expect(svg).toContain(`href="${STRIP}"`);
    // Kad traka postoji, sponzori se ne slažu iznova.
    expect(svg).not.toContain('Zlatni 1');
    expect(svg.match(/<image /g)).toHaveLength(1);
  });

  it('bez trake se svi sponzori slože na licu mjesta, zlatni prvi', () => {
    const svg = shareCardSvg({ ...base, sponsors: turnir });
    for (const x of turnir) expect(svg).toContain(`>${x.name}<`);
    const at = (n: string) => Number(new RegExp(`y="([\\d.]+)"[^>]*>${n}<`).exec(svg)![1]);
    expect(at('Zlatni 1')).toBeLessThan(at('Srebrni 1'));
    expect(at('Srebrni 1')).toBeLessThan(at('Partner'));
  });

  it('svi sponzori stanu u traku, ne iscure izvan slike', () => {
    const body = sponsorStripBody(turnir);
    const rects = [...body.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)];
    expect(rects).toHaveLength(turnir.length);
    for (const [, x, y, w, h] of rects) {
      expect(Number(x)).toBeGreaterThanOrEqual(0);
      expect(Number(y)).toBeGreaterThanOrEqual(0);
      expect(Number(x) + Number(w)).toBeLessThanOrEqual(SHARE_STRIP_W + 0.5);
      expect(Number(y) + Number(h)).toBeLessThanOrEqual(SHARE_STRIP_H + 0.5);
    }
  });

  it('zlatni su veći od srebrnih, srebrni od partnera', () => {
    const body = sponsorStripBody(turnir);
    const hOf = (n: string) =>
      Number(new RegExp(`height="([\\d.]+)"[^>]*/>\\s*<text[^>]*>${n}<`).exec(body)![1]);
    expect(hOf('Zlatni 1')).toBeGreaterThan(hOf('Srebrni 1'));
    expect(hOf('Srebrni 1')).toBeGreaterThan(hOf('Partner'));
  });

  it('deset zlatnih ide u dva jednaka reda (5 + 5), ne 7 + 3', () => {
    const body = sponsorStripBody(turnir.filter((x) => x.tier === 'gold'));
    const ys = [...body.matchAll(/<rect x="[\d.]+" y="([\d.]+)"/g)].map((m) => m[1]);
    const perRow = [...new Set(ys)].map((y) => ys.filter((v) => v === y).length);
    expect(perRow).toEqual([5, 5]);
  });

  it('jedan sponzor ne postaje golem', () => {
    const body = sponsorStripBody([s('Jedini', 'gold', LOGO)]);
    const h = Number(/height="([\d.]+)"/.exec(body)![1]);
    expect(h).toBeLessThanOrEqual(80);
  });

  it('samostalna traka ima pozadinu slike i dvostruku razlučivost', () => {
    const svg = sponsorStripSvg(turnir);
    expect(svg).toContain(`width="${SHARE_STRIP_W * 2}"`);
    expect(svg).toContain(`viewBox="0 0 ${SHARE_STRIP_W} ${SHARE_STRIP_H}"`);
  });

  it('bez sponzora se blok uopće ne crta', () => {
    expect(shareCardSvg(base)).not.toContain('SPONZORI');
  });
});
