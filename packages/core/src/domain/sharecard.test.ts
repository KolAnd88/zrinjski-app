import { describe, expect, it } from 'vitest';
import { shareCardSvg, type ShareCardOpts, type ShareSponsor } from './sharecard';

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

  // Sponzori počinju na 1139 (srebrni red, visina 62, sredina 1170). Popis
  // strijelaca se skuplja da stane iznad — inače bi im pisao preko logotipa.
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
    expect(lastScorerY(svg)).toBeLessThan(1139);
  });

  it('kod uobičajena tri strijelca raspored ostaje nepromijenjen', () => {
    const svg = shareCardSvg(sa);
    // Prvi redak na 972 uz slova 26 — vrijednosti od prije prilagodljivog popisa.
    expect(svg).toMatch(/y="972"[^>]*font-size="26"/);
  });

  // Jedan stupac s deset imena pao bi na 13 px i ne bi se pročitao na telefonu.
  it('dug popis se lomi u dva pod-stupca umjesto da slova postanu sitna', () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `Igrac ${i + 1}`, goals: 1 }));
    const scorerFonts = (svg: string) =>
      [...svg.matchAll(/<text x="(-?\d+)" y="(\d+)"[^>]*?font-size="(\d+)"[^>]*>[^<]*<tspan/gs)]
        .map((m) => ({ x: Number(m[1]), y: Number(m[2]), fs: Number(m[3]) }))
        .filter((r) => r.y > 880);

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

describe('shareCardSvg — sponzori', () => {
  const s = (name: string, tier: ShareSponsor['tier'], logo?: string): ShareSponsor => ({
    name,
    tier,
    logo: logo ?? null,
  });
  const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

  it('zlatni ide u vrpcu u zaglavlju', () => {
    const svg = shareCardSvg({ ...base, sponsors: [s('Livno-Bus', 'gold')] });
    expect(svg).toContain('ZLATNI SPONZOR');
    expect(svg).toContain('LIVNO-BUS');
  });

  it('sponzor s logotipom dobiva sliku, bez logotipa ime', () => {
    const svg = shareCardSvg({
      ...base,
      sponsors: [s('Lager', 'silver', LOGO), s('Konzum', 'partner')],
    });
    expect(svg).toContain(`href="${LOGO}"`);
    expect(svg).toContain('>Konzum<');
  });

  it('razredi se slažu u tri reda, odozgo prema dolje', () => {
    const svg = shareCardSvg({
      ...base,
      sponsors: [s('Srebro', 'silver'), s('Bronca', 'bronze'), s('Partner', 'partner')],
    });
    const at = (n: string) => Number(new RegExp(`y="([\\d.]+)"[^>]*>${n}<`).exec(svg)![1]);
    expect(at('Srebro')).toBeLessThan(at('Bronca'));
    expect(at('Bronca')).toBeLessThan(at('Partner'));
  });

  it('puno sponzora u jednom razredu se smanji, ne iscuri izvan slike', () => {
    const puno = Array.from({ length: 9 }, (_, i) => s(`Sponzor ${i}`, 'silver'));
    const svg = shareCardSvg({ ...base, sponsors: puno });
    const lefts = numbersOf(svg, 'x').filter((n) => n < 2000);
    expect(Math.min(...lefts)).toBeGreaterThanOrEqual(0);
    // Desni rub zadnje pločice mora ostati unutar 1080.
    const rects = [...svg.matchAll(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)];
    for (const [, x, w] of rects) expect(Number(x) + Number(w)).toBeLessThanOrEqual(1080.5);
  });

  it('bez sponzora se blok uopće ne crta', () => {
    expect(shareCardSvg(base)).not.toContain('SPONZORI');
  });
});

describe('shareCardSvg — više zlatnih sponzora', () => {
  const gold = (name: string): ShareSponsor => ({ name, tier: 'gold' });
  const TRI = [gold('Alfa'), gold('Beta'), gold('Gama')];

  const zaUtakmicu = (h: string, a: string, sponsors: ShareSponsor[]) =>
    shareCardSvg({ ...base, home: { ...base.home, name: h }, away: { ...base.away, name: a }, sponsors });

  const kojiZlatni = (svg: string) => TRI.map((s) => s.name).filter((n) => svg.includes(n.toUpperCase()));

  it('jedan zlatni je uvijek taj', () => {
    const svg = zaUtakmicu('Zrinjski', 'Posušje', [gold('Alfa')]);
    expect(svg).toContain('ALFA');
  });

  // Pločica u zaglavlju je jedna, pa se ne smiju pojaviti dva imena odjednom.
  it('na jednoj slici je točno jedan zlatni', () => {
    expect(kojiZlatni(zaUtakmicu('Zrinjski', 'Posušje', TRI))).toHaveLength(1);
  });

  // Dvije slike iste utakmice moraju biti jednake — inače bi sponzor
  // "nestao" pri ponovnom dijeljenju.
  it('ista utakmica uvijek daje istog zlatnog', () => {
    const a = kojiZlatni(zaUtakmicu('Zrinjski', 'Posušje', TRI));
    const b = kojiZlatni(zaUtakmicu('Zrinjski', 'Posušje', TRI));
    expect(a).toEqual(b);
  });

  // Smisao rotacije: kroz turnir svi zlatni dođu na red, a ne samo prvi.
  it('kroz više utakmica se izmjenjuju svi', () => {
    const parovi: [string, string][] = [
      ['Zrinjski', 'Posušje'], ['Grude', 'Čapljina'], ['Ljubuški', 'Mostar'],
      ['Široki', 'Livno'], ['Neum', 'Stolac'], ['Metković', 'Imotski'],
      ['Vitez', 'Travnik'], ['Jajce', 'Bugojno'], ['Konjic', 'Prozor'],
    ];
    const vidjeni = new Set(parovi.flatMap(([h, a]) => kojiZlatni(zaUtakmicu(h, a, TRI))));
    expect(vidjeni.size).toBe(3);
  });
});
