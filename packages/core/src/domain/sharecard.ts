// sharecard.ts — uspravna slika rezultata za Facebook i Instagram.
//
// Zašto 1080×1350 (4:5), a ne 1200×630 kao promo kartica u adminu: onaj je
// format Facebookov. Instagram feed reže na kvadrat ili 4:5, a Priče su
// uspravne — vodoravna slika ondje završi kao tanka crta među crnim prazninama.
// 4:5 prolazi na oba mjesta i dobro izgleda kad ga netko baci u Priču.
//
// Slaganje je vođeno jednim pravilom: SLIKA SE GLEDA POLA SEKUNDE. Zato je
// rezultat golem i u sredini, grbovi su veliki i jedan nasuprot drugom, a
// pobjednika nosi svjetliji naziv ekipe (gubitnik je prigušen).
//
// SPONZORI: svi, redom zlatni → srebrni → brončani → partneri, u traci na dnu
// (odluka organizatora — ne jedan zlatni u zaglavlju). Traka je STALAN dio
// slike: admin je složi jednom kao jednu malu sliku (sponsorStripSvg), a pri
// dijeljenju se mijenjaju samo grbovi, rezultat i strijelci. Ranije su se u
// svaku sliku ugrađivali logotipi svih sponzora u punoj veličini (~2,9 MB), što
// je na Androidu rušilo aplikaciju.
//
// Napomena: adresa aplikacije se NE utiskuje (odluka organizatora). Instagram
// uz sliku ne prosljeđuje ni tekst ni poveznicu, pa slika nema puta natrag —
// jedini trag je naziv turnira u zaglavlju.
import { colors, crestGradientFor } from '@zrinjski/ui-tokens';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Duga imena moraju stati u redak — režemo s tri točke, ne prelamamo. */
function clip(s: string, max: number): string {
  const v = s.trim();
  return v.length <= max ? v : `${v.slice(0, max - 1).trimEnd()}…`;
}

export type ShareSide = {
  name: string;
  /** Tri slova za grb; prazno → uzima se iz imena. */
  code: string | null;
  /** Indeks za gradijent grba (team.sort_order). */
  crestIndex: number;
  score: number;
  /**
   * Pravi grb ekipe kao data URI — UMANJEN (team.logo_small_url, do 192 px).
   * Bez njega se crta znak s kraticom u boji ekipe.
   */
  logo?: string | null;
};

export type ShareScorer = { name: string; goals: number };

/**
 * Sponzor u traci.
 *
 * `logo` MORA biti data URI (`data:image/png;base64,…`), ne poveznica na
 * Storage: slika se dijeli dalje i otvara na tuđim uređajima, a vanjska slika
 * bi pri pretvorbi u PNG kroz canvas "zatrovala" platno pa se ne bi dala
 * izvesti. Tko nema logo, dobiva ime.
 */
export type ShareSponsor = {
  name: string;
  tier: 'gold' | 'silver' | 'bronze' | 'partner';
  logo?: string | null;
};

export type ShareCardOpts = {
  home: ShareSide;
  away: ShareSide;
  /** "Grupa A", "Finale"… */
  stageLabel: string;
  /** "6.6.2026." — već formatiran, core ne zna lokalizaciju prikaza. */
  dateLabel: string;
  tournamentName: string;
  /** Strijelci odvojeno po ekipama — inače se ne zna tko je čiji. */
  scorers?: { home: ShareScorer[]; away: ShareScorer[] };
  /**
   * Unaprijed složena traka sponzora (tournament.share_sponsors_url) kao data
   * URI. Ima prednost pred `sponsors`.
   */
  sponsorStrip?: string | null;
  /** Kad trake nema: sponzori se slažu ovdje (bez logotipa je to lagano). */
  sponsors?: ShareSponsor[];
  isFinal?: boolean;
  /** Natpisi — core ne zna jezik sučelja. */
  labels?: { scorers?: string; sponsors?: string };
};

const W = 1080;
const H = 1350;

/** Traka sponzora: dimenzije u slici rezultata (i u slici koju admin složi). */
export const SHARE_STRIP_W = 1000;
export const SHARE_STRIP_H = 290;
const STRIP_X = (W - SHARE_STRIP_W) / 2;
const STRIP_Y = 1036;

/**
 * Kratica za grb kad ekipa nema upisan `short_code`.
 *
 * Prva tri slova prve riječi — tako izgledaju i kratice koje organizator sam
 * upisuje (Grude Legende → GRU, Posušje veterani → POS). Inicijali riječi
 * ("G-L-e") dale bi nešto što nitko ne bi prepoznao.
 */
function fallbackCode(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  // Kratka prva riječ ("AS Mostar") dopunjava se sljedećima da kratica ima 3 slova.
  const source = words[0]!.length >= 3 ? words[0]! : words.join('');
  return source.slice(0, 3).toUpperCase();
}

const codeOf = (s: ShareSide) => (s.code || fallbackCode(s.name)).slice(0, 3).toUpperCase();

/**
 * Grb: pravi grb ekipe ako ga ima, inače zaobljeni kvadrat s gradijentom i
 * tri slova — isti kao u aplikaciji.
 */
function crest(s: ShareSide, cx: number, cy: number, size: number, key: string): string {
  const x = cx - size / 2;
  const y = cy - size / 2;
  if (s.logo) {
    const pad = Math.round(size * 0.08);
    return `
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.22}"
        fill="#FFFFFF" fill-opacity="0.06" stroke="${colors.line}" stroke-width="2"/>
  <image x="${x + pad}" y="${y + pad}" width="${size - 2 * pad}" height="${size - 2 * pad}"
         preserveAspectRatio="xMidYMid meet" href="${s.logo}"/>`;
  }
  const [c1, c2] = crestGradientFor(s.crestIndex);
  return `
  <defs>
    <linearGradient id="${key}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.22}"
        fill="url(#${key})"/>
  <text x="${cx}" y="${cy}" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="${Math.round(size * 0.34)}" text-anchor="middle"
        dominant-baseline="central">${esc(codeOf(s))}</text>`;
}

// ── Traka sponzora ─────────────────────────────────────────────────────────

const TIERS = [
  { tier: 'gold' as const, ratio: 1, stroke: colors.gold, text: colors.gold },
  { tier: 'silver' as const, ratio: 0.8, stroke: colors.silver, text: colors.silverTxt },
  { tier: 'bronze' as const, ratio: 0.68, stroke: colors.bronze, text: colors.bronzeTxt },
  { tier: 'partner' as const, ratio: 0.58, stroke: colors.line, text: colors.sub },
];
/** Logotipi u adminu su 900×408. */
const TILE_ASPECT = 2.2;
const GAP = 10;
const ROW_GAP = 10;
const TIER_GAP = 16;
/** Ni jedan sponzor ne smije biti velik — traka je potpis, ne reklama. */
const MAX_GOLD_H = 80;

type TierPlan = { spec: (typeof TIERS)[number]; list: ShareSponsor[]; th: number; tw: number; rows: number; perRow: number };

function planTiers(sponsors: ShareSponsor[], w: number, goldH: number): { tiers: TierPlan[]; height: number } {
  const tiers: TierPlan[] = [];
  for (const spec of TIERS) {
    const list = sponsors.filter((s) => s.tier === spec.tier);
    if (list.length === 0) continue;
    const th = goldH * spec.ratio;
    const tw = th * TILE_ASPECT;
    const fit = Math.max(1, Math.floor((w + GAP) / (tw + GAP)));
    const rows = Math.ceil(list.length / fit);
    // Redovi jednake duljine (10 → 5+5, ne 7+3) — izgleda složeno, ne ostatak.
    const perRow = Math.ceil(list.length / rows);
    tiers.push({ spec, list, th, tw, rows, perRow });
  }
  const height =
    tiers.reduce((sum, t) => sum + t.rows * t.th + (t.rows - 1) * ROW_GAP, 0) +
    Math.max(0, tiers.length - 1) * TIER_GAP;
  return { tiers, height };
}

/**
 * Unutrašnjost trake (bez pozadine), u koordinatama 0..w × 0..h.
 *
 * Veličina pločica se bira najvećom koja stane: deset zlatnih idu u dva reda
 * po pet, srebrni ispod, manji, i tako dalje. Pločica nosi rub u boji razreda.
 */
export function sponsorStripBody(sponsors: ShareSponsor[], w = SHARE_STRIP_W, h = SHARE_STRIP_H): string {
  if (sponsors.length === 0) return '';

  // Najveća visina zlatne pločice s kojom sve stane (binarna pretraga).
  let lo = 8;
  let hi = MAX_GOLD_H;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (planTiers(sponsors, w, mid).height <= h) lo = mid;
    else hi = mid;
  }
  const { tiers, height } = planTiers(sponsors, w, lo);

  let y = (h - height) / 2;
  const out: string[] = [];
  for (const t of tiers) {
    for (let r = 0; r < t.rows; r++) {
      const row = t.list.slice(r * t.perRow, (r + 1) * t.perRow);
      const rowW = row.length * t.tw + (row.length - 1) * GAP;
      let x = (w - rowW) / 2;
      for (const s of row) {
        out.push(tile(s, t, x, y));
        x += t.tw + GAP;
      }
      y += t.th + (r < t.rows - 1 ? ROW_GAP : 0);
    }
    y += TIER_GAP;
  }
  return out.join('\n  ');
}

function tile(s: ShareSponsor, t: TierPlan, x: number, y: number): string {
  const f = (n: number) => n.toFixed(1);
  const rx = Math.max(4, t.th * 0.14);
  if (s.logo) {
    const px = t.th * 0.1;
    return `<rect x="${f(x)}" y="${f(y)}" width="${f(t.tw)}" height="${f(t.th)}" rx="${f(rx)}"
        fill="#FFFFFF" stroke="${t.spec.stroke}" stroke-width="2"/>
  <image x="${f(x + px)}" y="${f(y + px)}" width="${f(t.tw - 2 * px)}" height="${f(t.th - 2 * px)}"
         preserveAspectRatio="xMidYMid meet" href="${s.logo}"/>`;
  }
  const fs = Math.max(9, t.th * 0.3);
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(t.tw)}" height="${f(t.th)}" rx="${f(rx)}"
        fill="${colors.card}" stroke="${t.spec.stroke}" stroke-width="1.5"/>
  <text x="${f(x + t.tw / 2)}" y="${f(y + t.th / 2)}" fill="${t.spec.text}" dominant-baseline="central"
        font-family="Oswald, sans-serif" font-weight="600" font-size="${f(fs)}"
        text-anchor="middle">${esc(clip(s.name, 14))}</text>`;
}

/**
 * Samostalna slika trake — admin je pretvori u JPEG i spremi jednom
 * (tournament.share_sponsors_url). `scale` daje oštrinu za sitne logotipe.
 */
export function sponsorStripSvg(sponsors: ShareSponsor[], scale = 2): string {
  const w = SHARE_STRIP_W;
  const h = SHARE_STRIP_H;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${colors.bg}"/>
  ${sponsorStripBody(sponsors, w, h)}
</svg>`;
}

/**
 * Slika rezultata jedne utakmice, spremna za objavu.
 * Vraća SVG niz — pozivatelj ga prikaže ili pretvori u PNG.
 */
export function shareCardSvg(o: ShareCardOpts): string {
  const accent = o.isFinal ? colors.gold : colors.red;
  const draw = o.home.score === o.away.score;
  const winner = draw ? null : o.home.score > o.away.score ? o.home : o.away;

  const L = {
    scorers: o.labels?.scorers ?? 'STRIJELCI',
    sponsors: o.labels?.sponsors ?? 'SPONZORI',
  };

  const CX = W / 2;
  const CREST_Y = 360;
  const CREST = 200;
  const COL_L = 250;
  const COL_R = W - 250;

  // Ime ekipe ispod grba. Pobjednikovo je bijelo, gubitnikovo prigušeno —
  // kod neriješenog su oba bijela, inače slika sugerira poraz obojici.
  const teamName = (s: ShareSide, cx: number) =>
    `<text x="${cx}" y="${CREST_Y + CREST / 2 + 52}" fill="${draw || s === winner ? '#FFFFFF' : colors.mut}"
        font-family="Oswald, sans-serif" font-weight="600" font-size="34" text-anchor="middle"
        >${esc(clip(s.name, 16).toUpperCase())}</text>`;

  // ── Strijelci u dva stupca, ispod svoje ekipe ────────────────────────────
  // SVI strijelci, ne samo prvih par: tko je zabio jest cijeli smisao ovakve
  // objave, a igraču koji je ispao pod crtu slika ne znači ništa.
  const homeScorers = (o.scorers?.home ?? []).filter((s) => s.goals > 0);
  const awayScorers = (o.scorers?.away ?? []).filter((s) => s.goals > 0);
  const longest = Math.max(homeScorers.length, awayScorers.length, 1);

  /**
   * Dug popis se lomi u DVA pod-stupca po ekipi, umjesto da se slova smanjuju.
   *
   * Jedan stupac s deset strijelaca pao bi na 13 px, a s četrnaest na 12 px —
   * stane, ali se na telefonu ne pročita. Lomljenjem u dva stupca ostaje
   * dvadesetak piksela, što je i dalje čitko.
   */
  const split = longest > 6;
  const scorerRows = split ? Math.ceil(longest / 2) : longest;

  // Popis mora stati između rezultata i trake sponzora (crta je na 992).
  const BAND_BOTTOM = 972;
  // Kod dugog popisa blok kreće više — ispod rezultata ionako stoji prazan
  // prostor koji se drukčije ne koristi.
  const tight = scorerRows > 5;
  const HEAD_Y = tight ? 765 : 785;
  const START_Y = tight ? 798 : 826;
  const step = Math.min(34, Math.floor((BAND_BOTTOM - START_Y) / scorerRows));
  const fs = Math.max(12, Math.min(26, step - 7));
  /** Razmak pod-stupaca; u dva stupca ime mora biti kraće da ne naliježu. */
  const SUB = 115;
  const nameChars = split ? 16 : fs >= 24 ? 20 : fs >= 18 ? 24 : 28;

  const scorerLine = (s: ShareScorer, x: number, y: number) =>
    `<text x="${x}" y="${y}" fill="${colors.txt2}"
        font-family="Inter, sans-serif" font-size="${fs}" text-anchor="middle"
        >${esc(clip(s.name, nameChars))} <tspan fill="${accent}" font-weight="700">${s.goals}</tspan></text>`;

  // Stupac stoji točno ispod grba svoje ekipe, pa kratica iznad njega ne bi
  // rekla ništa novo — samo bi dodala redak.
  const scorerColumn = (list: ShareScorer[], cx: number) => {
    if (list.length === 0) {
      return `<text x="${cx}" y="${START_Y}" fill="${colors.mut}" font-family="Inter, sans-serif"
        font-size="${fs}" text-anchor="middle">—</text>`;
    }
    if (!split) {
      return list.map((s, i) => scorerLine(s, cx, START_Y + i * step)).join('\n  ');
    }
    // Prvi pod-stupac nosi bolje strijelce (popis je već složen po golovima),
    // pa se najvažnija imena čitaju lijevo-desno kao i inače.
    const half = Math.ceil(list.length / 2);
    return list
      .map((s, i) =>
        i < half
          ? scorerLine(s, cx - SUB, START_Y + i * step)
          : scorerLine(s, cx + SUB, START_Y + (i - half) * step)
      )
      .join('\n  ');
  };

  const anyScorers = homeScorers.length + awayScorers.length > 0;
  const scorerBlock = anyScorers
    ? `
  <text x="${CX}" y="${HEAD_Y}" fill="${colors.mut}" font-family="Oswald, sans-serif" font-weight="600"
        font-size="22" letter-spacing="5" text-anchor="middle">${esc(L.scorers)}</text>
  <rect x="${CX - 1}" y="${START_Y - 22}" width="2" height="${scorerRows * step + 12}"
        fill="${colors.line}"/>
  ${scorerColumn(homeScorers, COL_L)}
  ${scorerColumn(awayScorers, COL_R)}`
    : '';

  // ── Sponzori: unaprijed složena traka, ili slaganje na licu mjesta ────────
  const stripContent = o.sponsorStrip
    ? `<image x="${STRIP_X}" y="${STRIP_Y}" width="${SHARE_STRIP_W}" height="${SHARE_STRIP_H}"
         preserveAspectRatio="xMidYMid meet" href="${o.sponsorStrip}"/>`
    : o.sponsors?.length
      ? `<g transform="translate(${STRIP_X} ${STRIP_Y})">
  ${sponsorStripBody(o.sponsors)}
  </g>`
      : '';

  const sponsorBlock = stripContent
    ? `
  <rect x="72" y="992" width="${W - 144}" height="1" fill="${colors.line}"/>
  <text x="${CX}" y="1022" fill="${colors.mut}" font-family="Oswald, sans-serif"
        font-weight="600" font-size="20" letter-spacing="5" text-anchor="middle">${esc(L.sponsors)}</text>
  ${stripContent}`
    : '';

  // Naziv turnira se NE reže — ime turnira mora biti čitljivo cijelo, inače
  // slika nema čemu pripada. Umjesto toga se slova smanje toliko da stanu u
  // širinu slike. Oswald Bold je širok otprilike 0.54 × visina slova.
  const titleRoom = W - 144;
  const titleLen = Math.max(o.tournamentName.length, 1);
  const titleSize = Math.max(26, Math.min(46, Math.floor(titleRoom / (titleLen * 0.54 + titleLen * 0.05))));

  // Ishod se NE piše riječima (traka je smetala) — pobjednika nosi svjetliji
  // naziv ekipe, gubitnika prigušen. Kod neriješenog su oba svijetla.

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.redDk}"/>
      <stop offset="1" stop-color="${colors.red}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8A6E1F"/>
      <stop offset="1" stop-color="${colors.gold}"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-30%" width="120%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.35"/>
    </filter>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${colors.bg}"/>

  <!-- Zaglavlje: puni blok u boji, ne blijeda lenta. Slika mora imati težinu
       na vrhu da se u pregledu objave odmah vidi čije je. -->
  <path d="M0 0 H${W} V176 L0 226 Z" fill="url(#${o.isFinal ? 'gold' : 'hdr'})"/>
  <!-- Tanka zlatna nit uz sam vrh — ista gesta kao na kartici pokrovitelja
       u aplikaciji, veže sliku uz ostatak. -->
  <rect x="0" y="0" width="${W}" height="5" fill="${colors.gold}"/>
  <text x="72" y="92" fill="#FFFFFF" font-family="Oswald, sans-serif" font-weight="700"
        font-size="${titleSize}" letter-spacing="2" filter="url(#soft)"
        >${esc(o.tournamentName.toUpperCase())}</text>
  <rect x="72" y="108" width="86" height="5" rx="2.5" fill="#FFFFFF" fill-opacity="0.55"/>
  <text x="72" y="154" fill="#FFFFFF" fill-opacity="0.86" font-family="Inter, sans-serif"
        font-size="28">${esc(o.stageLabel)} · ${esc(o.dateLabel)}</text>

  <!-- Sjaj iza rezultata: daje dubinu i vuče oko u sredinu. -->
  <ellipse cx="${CX}" cy="620" rx="520" ry="250" fill="url(#glow)"/>

  ${crest(o.home, COL_L, CREST_Y, CREST, 'ch')}
  ${crest(o.away, COL_R, CREST_Y, CREST, 'ca')}
  ${teamName(o.home, COL_L)}
  ${teamName(o.away, COL_R)}

  <text x="${CX}" y="${CREST_Y + 16}" fill="${colors.mut}" font-family="Oswald, sans-serif"
        font-weight="600" font-size="44" text-anchor="middle">VS</text>

  <!-- Rezultat: najveći element na slici, u sredini. -->
  <text x="${CX}" y="725" fill="#FFFFFF" font-family="Oswald, sans-serif" font-weight="700"
        font-size="230" text-anchor="middle" letter-spacing="-4"
        >${o.home.score}<tspan fill="${accent}"> : </tspan>${o.away.score}</text>

  ${scorerBlock}
  ${sponsorBlock}
</svg>`;
}
