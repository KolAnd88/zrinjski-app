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
};

export type ShareScorer = { name: string; goals: number };

/**
 * Sponzor na slici; zlatni ide u zaglavlje, ostali dolje.
 *
 * `logo` MORA biti data URI (`data:image/png;base64,…`), ne poveznica na
 * Storage. Slika se dijeli dalje i otvara na tuđim uređajima — vanjska
 * poveznica ondje ne bi bila dohvatljiva, a pri pretvorbi u PNG kroz canvas
 * bi ga i "zatrovala" pa se ne bi dala izvesti. Tko nema logo, dobiva ime.
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
  sponsors?: ShareSponsor[];
  isFinal?: boolean;
  /** Natpisi — core ne zna jezik sučelja. */
  labels?: { scorers?: string; sponsors?: string; goldSponsor?: string };
};

/**
 * Stalan indeks iz teksta — ista utakmica uvijek daje isti izbor.
 *
 * Namjerno NIJE slučajan: dvije slike iste utakmice moraju izgledati jednako,
 * inače bi sponzor "nestao" pri ponovnom dijeljenju.
 */
function stableIndex(key: string, n: number): number {
  if (n <= 0) return 0;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % n;
}

const W = 1080;
const H = 1350;

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

/** Grb: zaobljeni kvadrat s gradijentom i tri slova — isti kao u aplikaciji. */
function crest(s: ShareSide, cx: number, cy: number, size: number, key: string): string {
  const [c1, c2] = crestGradientFor(s.crestIndex);
  return `
  <defs>
    <linearGradient id="${key}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect x="${cx - size / 2}" y="${cy - size / 2}" width="${size}" height="${size}" rx="${size * 0.22}"
        fill="url(#${key})"/>
  <text x="${cx}" y="${cy}" fill="#fff" font-family="Oswald, sans-serif" font-weight="700"
        font-size="${Math.round(size * 0.34)}" text-anchor="middle"
        dominant-baseline="central">${esc(codeOf(s))}</text>`;
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
    goldSponsor: o.labels?.goldSponsor ?? 'ZLATNI SPONZOR',
    sponsors: o.labels?.sponsors ?? 'SPONZORI',
  };

  const CX = W / 2;
  const CREST_Y = 455;
  const CREST = 230;
  const COL_L = 250;
  const COL_R = W - 250;

  // Ime ekipe ispod grba. Pobjednikovo je bijelo, gubitnikovo prigušeno —
  // kod neriješenog su oba bijela, inače slika sugerira poraz obojici.
  const teamName = (s: ShareSide, cx: number) =>
    `<text x="${cx}" y="${CREST_Y + CREST / 2 + 62}" fill="${draw || s === winner ? '#FFFFFF' : colors.mut}"
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

  // Popis mora stati između rezultata i prvog reda sponzora (vrh mu je na
  // 1139). Kod uobičajena tri do četiri strijelca ostaje točno kako je i bilo.
  const BAND_BOTTOM = 1128;
  // Kod dugog popisa blok kreće više — ispod rezultata ionako stoji prazan
  // prostor koji se drukčije ne koristi.
  const tight = scorerRows > 5;
  const HEAD_Y = tight ? 890 : 928;
  const START_Y = tight ? 928 : 972;
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

  // ── Sponzori ─────────────────────────────────────────────────────────────
  // Zlatni ide GORE, uz naziv turnira: to je najgledaniji dio slike. Ostali razredi idu dolje, svaki u boji svog razreda — iste
  // boje kao na Početnoj.
  const all = o.sponsors ?? [];

  // Zlatnih sponzora može biti više, a pločica u zaglavlju je jedna — najbolje
  // mjesto na slici i ne da se podijeliti a da ostane čitljivo.
  //
  // Zato se bira po utakmici, a ne uvijek prvi: svaka utakmica dobiva SVOG
  // zlatnog sponzora, uvijek istog za istu utakmicu (izbor je izveden iz imena
  // ekipa, ne iz slučaja). Kroz turnir se tako izloženost ravnomjerno podijeli,
  // umjesto da jedan sponzor pokupi sve slike a ostali nijednu.
  const golds = all.filter((s) => s.tier === 'gold');
  const gold = golds.length ? (golds[stableIndex(o.home.name + o.away.name, golds.length)] ?? null) : null;

  // Podloga je bijela kad ima logotipa — logotipi dolaze i kao JPEG s bijelim
  // rubom, pa bi na tamnom izgledali kao zakrpa. Bez logotipa ostaje ime na
  // tamnom, zlatnim slovima.
  const goldName = gold ? clip(gold.name, 18).toUpperCase() : '';
  const plaqueW = gold?.logo ? 330 : Math.max(300, goldName.length * 25 + 80);
  const plaqueX = W - 72 - plaqueW;

  // Pločica: zlatna vrpca s natpisom razreda gore, sadržaj ispod. Vrpca je
  // čitljivija od sitnog zlatnog teksta na bijelom, a i "zaključava" pločicu
  // uz zaglavlje. Sjena je odvaja od podloge preko koje prelazi.
  const PY = 132;
  const PH = 132;
  const RIBBON = 40;
  const plaqueFrame = `
  <g filter="url(#drop)">
    <rect x="${plaqueX}" y="${PY}" width="${plaqueW}" height="${PH}" rx="18"
          fill="${gold?.logo ? '#FFFFFF' : colors.card}" stroke="url(#gold)" stroke-width="3"/>
  </g>
  <path d="M${plaqueX} ${PY + RIBBON} V${PY + 18} a18 18 0 0 1 18 -18 H${plaqueX + plaqueW - 18}
           a18 18 0 0 1 18 18 V${PY + RIBBON} Z" fill="url(#gold)"/>
  <text x="${plaqueX + plaqueW / 2}" y="${PY + 28}" fill="#2A1F05" font-family="Oswald, sans-serif"
        font-weight="700" font-size="18" letter-spacing="4" text-anchor="middle"
        >${esc(L.goldSponsor)}</text>`;

  const goldBlock = !gold
    ? ''
    : gold.logo
      ? `${plaqueFrame}
  <image x="${plaqueX + 22}" y="${PY + RIBBON + 12}" width="${plaqueW - 44}" height="${PH - RIBBON - 24}"
         preserveAspectRatio="xMidYMid meet" href="${gold.logo}"/>`
      : `${plaqueFrame}
  <text x="${plaqueX + plaqueW / 2}" y="${PY + RIBBON + 52}" fill="${colors.gold}"
        font-family="Oswald, sans-serif" font-weight="700" font-size="36" letter-spacing="1"
        text-anchor="middle">${esc(goldName)}</text>`;

  // Naziv turnira se NE reže — ime turnira mora biti čitljivo cijelo, inače
  // slika nema čemu pripada. Umjesto toga se slova smanje toliko da stanu do
  // pločice pokrovitelja. Oswald Bold je širok otprilike 0.54 × visina slova.
  const titleRoom = W - 144;
  const titleLen = Math.max(o.tournamentName.length, 1);
  const titleSize = Math.max(26, Math.min(46, Math.floor(titleRoom / (titleLen * 0.54 + titleLen * 0.05))));

  // ── Ostali sponzori: po jedan red za svaki razred ────────────────────────
  // Srebrni gore, brončani ispod, partneri na dnu. Razred se čita i iz
  // položaja i iz veličine pločice — kao i na Početnoj. Tko nema logo, dobiva
  // ime u boji svog razreda na tamnoj pločici.
  const TIERS = [
    { tier: 'silver' as const, w: 150, h: 62, mid: 1170, color: colors.silverTxt },
    { tier: 'bronze' as const, w: 126, h: 54, mid: 1240, color: colors.bronzeTxt },
    { tier: 'partner' as const, w: 108, h: 46, mid: 1302, color: colors.sub },
  ];

  const GAP = 18;
  const tierRow = (spec: (typeof TIERS)[number]) => {
    const list = all.filter((s) => s.tier === spec.tier);
    if (list.length === 0) return '';

    const rawW = list.length * spec.w + (list.length - 1) * GAP;
    // Puno sponzora u jednom razredu ne smije iscuriti izvan slike — taj se
    // red proporcionalno smanji, ostali ostaju kakvi jesu.
    const fit = Math.min(1, (W - 144) / rawW);
    const w = spec.w * fit;
    const h = spec.h * fit;
    let x = (W - rawW * fit) / 2;
    const y = spec.mid - h / 2;

    return list
      .map((s) => {
        const at = x;
        x += w + GAP * fit;
        return s.logo
          ? `<rect x="${at.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
        rx="10" fill="#FFFFFF"/>
  <image x="${(at + 9).toFixed(1)}" y="${(y + 7).toFixed(1)}" width="${(w - 18).toFixed(1)}"
         height="${(h - 14).toFixed(1)}" preserveAspectRatio="xMidYMid meet" href="${s.logo}"/>`
          : `<rect x="${at.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"
        rx="10" fill="${colors.card}" stroke="${spec.color}" stroke-width="1.5"/>
  <text x="${(at + w / 2).toFixed(1)}" y="${(spec.mid + 6).toFixed(1)}" fill="${spec.color}"
        font-family="Oswald, sans-serif" font-weight="600" font-size="${(19 * fit).toFixed(1)}"
        text-anchor="middle">${esc(clip(s.name, 12))}</text>`;
      })
      .join('\n  ');
  };

  const rows = TIERS.map(tierRow).filter(Boolean).join('\n  ');

  const sponsorBlock = rows
    ? `
  <rect x="72" y="1090" width="${W - 144}" height="1" fill="${colors.line}"/>
  <text x="${CX}" y="1124" fill="${colors.mut}" font-family="Oswald, sans-serif"
        font-weight="600" font-size="20" letter-spacing="5" text-anchor="middle">${esc(L.sponsors)}</text>
  ${rows}`
    : '';

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
    <filter id="drop" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.45"/>
    </filter>
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
  <path d="M0 0 H${W} V216 L0 276 Z" fill="url(#${o.isFinal ? 'gold' : 'hdr'})"/>
  <!-- Tanka zlatna nit uz sam vrh — ista gesta kao na kartici pokrovitelja
       u aplikaciji, veže sliku uz ostatak. -->
  <rect x="0" y="0" width="${W}" height="5" fill="${colors.gold}"/>
  <text x="72" y="112" fill="#FFFFFF" font-family="Oswald, sans-serif" font-weight="700"
        font-size="${titleSize}" letter-spacing="2" filter="url(#soft)"
        >${esc(o.tournamentName.toUpperCase())}</text>
  <rect x="72" y="130" width="86" height="5" rx="2.5" fill="#FFFFFF" fill-opacity="0.55"/>
  <text x="72" y="180" fill="#FFFFFF" fill-opacity="0.86" font-family="Inter, sans-serif"
        font-size="28">${esc(o.stageLabel)} · ${esc(o.dateLabel)}</text>

  ${goldBlock}

  <!-- Sjaj iza rezultata: daje dubinu i vuče oko u sredinu. -->
  <ellipse cx="${CX}" cy="770" rx="520" ry="250" fill="url(#glow)"/>

  ${crest(o.home, COL_L, CREST_Y, CREST, 'ch')}
  ${crest(o.away, COL_R, CREST_Y, CREST, 'ca')}
  ${teamName(o.home, COL_L)}
  ${teamName(o.away, COL_R)}

  <text x="${CX}" y="${CREST_Y + 22}" fill="${colors.mut}" font-family="Oswald, sans-serif"
        font-weight="600" font-size="44" text-anchor="middle">VS</text>

  <!-- Rezultat: najveći element na slici, u sredini. -->
  <text x="${CX}" y="840" fill="#FFFFFF" font-family="Oswald, sans-serif" font-weight="700"
        font-size="230" text-anchor="middle" letter-spacing="-4"
        >${o.home.score}<tspan fill="${accent}"> : </tspan>${o.away.score}</text>

  ${scorerBlock}
  ${sponsorBlock}
</svg>`;
}
