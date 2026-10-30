// finals.ts — završnica po konkurenciji, prema postavkama iz admina.
//
// Dosad je završnica bila zakucana: dvije grupe, polufinala A1–B2 i A2–B1,
// finale i 3. mjesto, jednako za obje konkurencije. Ženska konkurencija igra
// drukčije — tri grupe, prolazi samo prva, pa završna skupina svaki sa svakim
// — a klub želi i ubuduće mijenjati način bez nove verzije aplikacije.
//
// Zato se ovdje sve izvodi iz postavki:
//   • finalsSlots     — koje utakmice završnica ima i s kojim oznakama;
//   • planFinals      — koje ekipe u njih upisati kad postanu poznate;
//   • finalGroupTable — tablica završne skupine za prikaz.
//
// Utakmica završnice prepoznaje se po `finals_slot` ('sf1', 'final', 'fg2'…).
// Završna skupina ima fazu 'group' i nema grupu (grp_id = null): starije
// verzije aplikacije je tako prikažu u rasporedu, a ne crtaju je kao praznu
// tablicu ni kao kostur završnice.

import type { FinalsConfigRow, Stage } from '../types/database';
import type { KnockoutPatch } from './knockout';
import { computeStandings, type PointsConfig, type StandingRow } from './standings';
import { roundRobinPairings } from './fixtures';

export type FinalsFormat = 'bracket' | 'group';
/** Tko dobiva slobodan prolaz kad su u kosturu tri ekipe. */
export type ByeRule = 'seed' | 'draw';
/** Završna skupina: ekipe iz iste grupe igraju ponovno ili se prenosi rezultat. */
export type RematchRule = 'replay' | 'carry';

export type FinalsConfig = {
  format: FinalsFormat;
  advancePerGroup: number;
  luckyLosers: number;
  /** Utakmica za 3. mjesto — postoji samo kad su u kosturu četiri ekipe. */
  thirdPlace: boolean;
  byeRule: ByeRule;
  rematchRule: RematchRule;
};

/**
 * Zadane postavke prema broju grupa: tri grupe igraju završnu skupinu
 * pobjednika, sve ostalo polufinala i finale s prve dvije iz grupe.
 */
export function defaultFinalsConfig(groupCount: number): FinalsConfig {
  return groupCount === 3
    ? { format: 'group', advancePerGroup: 1, luckyLosers: 0, thirdPlace: false, byeRule: 'seed', rematchRule: 'replay' }
    : { format: 'bracket', advancePerGroup: 2, luckyLosers: 0, thirdPlace: true, byeRule: 'seed', rematchRule: 'replay' };
}

/** Postavke iz retka baze; bez retka zadane prema broju grupa. */
export function finalsConfigFromRow(row: FinalsConfigRow | null | undefined, groupCount: number): FinalsConfig {
  if (!row) return defaultFinalsConfig(groupCount);
  return {
    format: row.format,
    advancePerGroup: row.advance_per_group,
    luckyLosers: row.lucky_losers,
    thirdPlace: row.third_place,
    byeRule: row.bye_rule,
    rematchRule: row.rematch_rule,
  };
}

export function finalsConfigToRow(cfg: FinalsConfig): Omit<FinalsConfigRow, 'tournament_id' | 'gender' | 'updated_at'> {
  return {
    format: cfg.format,
    advance_per_group: cfg.advancePerGroup,
    lucky_losers: cfg.luckyLosers,
    third_place: cfg.thirdPlace,
    bye_rule: cfg.byeRule,
    rematch_rule: cfg.rematchRule,
  };
}

/** Koliko ekipa ulazi u završnicu. */
export function qualifierCount(cfg: FinalsConfig, groupCount: number): number {
  return groupCount * cfg.advancePerGroup + cfg.luckyLosers;
}

export function groupLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

// ── Provjera postavki ──────────────────────────────────────────────────────

export type FinalsProblem =
  | { key: 'no_groups' }
  | { key: 'too_few'; n: number }
  /** Kostur radi samo s 2, 3 ili 4 ekipe — četvrtfinala nema. */
  | { key: 'bracket_size'; n: number }
  /** Lucky loser se bira između drugoplasiranih, pa ih ne može biti više nego grupa. */
  | { key: 'too_many_lucky'; max: number }
  | { key: 'group_too_small'; group: string; size: number; need: number };

/**
 * Kombinacije koje se ne mogu odigrati. Prazna grupa (ždrijeb još nije
 * napravljen) se ne prijavljuje — to nije greška u postavkama.
 */
export function validateFinalsConfig(cfg: FinalsConfig, groupSizes: number[]): FinalsProblem[] {
  const g = groupSizes.length;
  if (g === 0) return [{ key: 'no_groups' }];
  const out: FinalsProblem[] = [];
  const n = qualifierCount(cfg, g);
  if (cfg.luckyLosers > g) out.push({ key: 'too_many_lucky', max: g });
  if (n < 2) out.push({ key: 'too_few', n });
  else if (cfg.format === 'bracket' && n > 4) out.push({ key: 'bracket_size', n });
  groupSizes.forEach((size, i) => {
    if (size > 0 && size < cfg.advancePerGroup) {
      out.push({ key: 'group_too_small', group: groupLetter(i), size, need: cfg.advancePerGroup });
    }
  });
  return out;
}

// ── Mjesta u završnici ─────────────────────────────────────────────────────

/** Odakle dolazi ekipa na nekom mjestu završnice. */
export type SlotRef =
  | { kind: 'group'; group: number; rank: number }
  | { kind: 'lucky'; n: number }
  | { kind: 'seed'; n: number }
  /** 0 = slobodan prolaz, 1 i 2 = polufinale. */
  | { kind: 'draw'; n: number }
  | { kind: 'winner'; slot: string }
  | { kind: 'loser'; slot: string };

export type FinalsSlot = {
  /** Stabilni ključ utakmice u bazi (`match.finals_slot`). */
  key: string;
  stage: Stage;
  home: SlotRef;
  away: SlotRef;
  homeLabel: string;
  awayLabel: string;
};

const ORDINAL = ['', 'prvi', 'drugi', 'treći', 'četvrti', 'peti', 'šesti', 'sedmi', 'osmi'];

function refLabel(ref: SlotRef, cfg: FinalsConfig, semis: number): string {
  switch (ref.kind) {
    case 'group':
      // "Pobjednik A" kad iz grupe ide samo jedna u završnu skupinu — tako se
      // to i govori; inače klasično "A1", "B2".
      return cfg.format === 'group' && cfg.advancePerGroup === 1
        ? `Pobjednik ${groupLetter(ref.group)}`
        : `${groupLetter(ref.group)}${ref.rank}`;
    case 'lucky': {
      const ord = ORDINAL[cfg.advancePerGroup + 1] ?? `${cfg.advancePerGroup + 1}.`;
      return ref.n === 1 ? `Najbolji ${ord}` : `${ref.n}. najbolji ${ord}`;
    }
    case 'seed':
      return `${ref.n}. nositelj`;
    case 'draw':
      return ref.n === 0 ? 'Slobodan prolaz (ždrijeb)' : `Ždrijeb ${ref.n}`;
    case 'winner':
      return semis === 1 ? 'Pobjednik PF' : `Pobjednik PF${ref.slot.slice(2)}`;
    case 'loser':
      return semis === 1 ? 'Poraženi PF' : `Poraženi PF${ref.slot.slice(2)}`;
  }
}

/** Sve ekipe koje prolaze, redom A1, B1, C1, A2, B2…, pa lucky loseri. */
function qualifierRefs(cfg: FinalsConfig, groupCount: number): SlotRef[] {
  const out: SlotRef[] = [];
  for (let rank = 1; rank <= cfg.advancePerGroup; rank++) {
    for (let group = 0; group < groupCount; group++) out.push({ kind: 'group', group, rank });
  }
  for (let n = 1; n <= cfg.luckyLosers; n++) out.push({ kind: 'lucky', n });
  return out;
}

/**
 * Nositelji kostura. Gdje je par poznat unaprijed, oznaka ostaje čitljiva
 * ("A1", "B1"); inače "1. nositelj" — tko je to, zna se tek po ljestvicama.
 */
function bracketSeeds(cfg: FinalsConfig, groupCount: number, n: number): SlotRef[] {
  if (groupCount === 1 && cfg.luckyLosers === 0) {
    return Array.from({ length: n }, (_, i) => ({ kind: 'group', group: 0, rank: i + 1 }) as SlotRef);
  }
  if (groupCount === 2 && cfg.advancePerGroup === 1 && cfg.luckyLosers === 0 && n === 2) {
    return [{ kind: 'group', group: 0, rank: 1 }, { kind: 'group', group: 1, rank: 1 }];
  }
  return Array.from({ length: n }, (_, i) => ({ kind: 'seed', n: i + 1 }) as SlotRef);
}

/**
 * Utakmice završnice za zadane postavke, redom kojim se igraju.
 * Prazno kad se postavke ne mogu odigrati (vidi validateFinalsConfig).
 */
export function finalsSlots(cfg: FinalsConfig, groupCount: number): FinalsSlot[] {
  if (groupCount === 0) return [];
  const n = qualifierCount(cfg, groupCount);
  if (n < 2) return [];

  type Raw = { key: string; stage: Stage; home: SlotRef; away: SlotRef };
  const raw: Raw[] = [];

  if (cfg.format === 'group') {
    const refs = qualifierRefs(cfg, groupCount);
    const pairs = roundRobinPairings(refs.map((_, i) => String(i)));
    let k = 1;
    for (const p of pairs) {
      const home = refs[Number(p.home)]!;
      const away = refs[Number(p.away)]!;
      // Prenošenje rezultata: ekipe iz iste grupe već su se srele, njihova
      // grupna utakmica računa se u tablici završne skupine.
      if (
        cfg.rematchRule === 'carry' &&
        home.kind === 'group' &&
        away.kind === 'group' &&
        home.group === away.group
      ) {
        continue;
      }
      raw.push({ key: `fg${k++}`, stage: 'group', home, away });
    }
  } else {
    if (n > 4) return [];
    const classic = groupCount === 2 && cfg.advancePerGroup === 2 && cfg.luckyLosers === 0;
    const s = bracketSeeds(cfg, groupCount, n);
    if (n === 4) {
      // Muški, kako se kod nas igra: A1–B2 i B1–A2.
      const [sf1, sf2] = classic
        ? [
            [{ kind: 'group', group: 0, rank: 1 }, { kind: 'group', group: 1, rank: 2 }],
            [{ kind: 'group', group: 1, rank: 1 }, { kind: 'group', group: 0, rank: 2 }],
          ] as [SlotRef, SlotRef][]
        : [[s[0]!, s[3]!], [s[1]!, s[2]!]];
      raw.push({ key: 'sf1', stage: 'semifinal', home: sf1[0], away: sf1[1] });
      raw.push({ key: 'sf2', stage: 'semifinal', home: sf2[0], away: sf2[1] });
      if (cfg.thirdPlace) {
        raw.push({ key: 'third', stage: 'third_place', home: { kind: 'loser', slot: 'sf1' }, away: { kind: 'loser', slot: 'sf2' } });
      }
      raw.push({ key: 'final', stage: 'final', home: { kind: 'winner', slot: 'sf1' }, away: { kind: 'winner', slot: 'sf2' } });
    } else if (n === 3) {
      // Jedna ekipa ide ravno u finale; poraženi u polufinalu je treći.
      const draw = cfg.byeRule === 'draw';
      raw.push({
        key: 'sf1',
        stage: 'semifinal',
        home: draw ? { kind: 'draw', n: 1 } : s[1]!,
        away: draw ? { kind: 'draw', n: 2 } : s[2]!,
      });
      raw.push({
        key: 'final',
        stage: 'final',
        home: draw ? { kind: 'draw', n: 0 } : s[0]!,
        away: { kind: 'winner', slot: 'sf1' },
      });
    } else {
      raw.push({ key: 'final', stage: 'final', home: s[0]!, away: s[1]! });
    }
  }

  const semis = raw.filter((r) => r.stage === 'semifinal').length;
  return raw.map((r) => ({
    ...r,
    homeLabel: refLabel(r.home, cfg, semis),
    awayLabel: refLabel(r.away, cfg, semis),
  }));
}

// ── Usklađenost s bazom ────────────────────────────────────────────────────

export type FinalsMatch = {
  id: string;
  finals_slot: string | null;
  stage: Stage;
  home_team_id: string | null;
  away_team_id: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number;
  away_score: number;
  status: 'scheduled' | 'live' | 'finished';
};

/** Odgovaraju li utakmice završnice u bazi postavkama. */
export function finalsInSync(slots: FinalsSlot[], matches: Pick<FinalsMatch, 'finals_slot' | 'stage' | 'home_placeholder' | 'away_placeholder'>[]): boolean {
  const mine = matches.filter((m) => m.finals_slot);
  if (mine.length !== slots.length) return false;
  return slots.every((s) => {
    const m = mine.find((x) => x.finals_slot === s.key);
    return !!m && m.stage === s.stage && m.home_placeholder === s.homeLabel && m.away_placeholder === s.awayLabel;
  });
}

/** Je li završnica počela — tada se način više ne smije mijenjati. */
export function finalsStarted(matches: Pick<FinalsMatch, 'finals_slot' | 'status'>[]): boolean {
  return matches.some((m) => m.finals_slot && m.status !== 'scheduled');
}

export function isFinalGroupMatch(m: { finals_slot?: string | null }): boolean {
  return !!m.finals_slot && m.finals_slot.startsWith('fg');
}

// ── Popunjavanje ekipa ─────────────────────────────────────────────────────

/** Poredak između grupa: bodovi, gol-razlika, postignuti golovi, naziv. */
function compareAcross(a: StandingRow, b: StandingRow): number {
  return (
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.teamName.localeCompare(b.teamName, 'hr')
  );
}

export type FinalsBlocker =
  | { key: 'groups_unfinished'; remaining: number }
  | { key: 'group_short'; group: string }
  | { key: 'out_of_sync' }
  | { key: 'draw_needed' }
  | { key: 'semifinal_drawn' }
  | { key: 'semifinal_unfinished' };

/** Mjesto na kojem je ekipa ručno postavljena drukčije nego po ljestvici. */
export type FinalsNote = { matchId: string; side: 'home' | 'away'; expectedTeamId: string };

export type FinalsPlan = {
  patches: KnockoutPatch[];
  blockers: FinalsBlocker[];
  notes: FinalsNote[];
};

export type PlanFinalsInput = {
  cfg: FinalsConfig;
  /** Ljestvice grupa redom (A, B, C…), već sortirane. */
  groups: StandingRow[][];
  /** Koliko utakmica grupne faze te konkurencije još nije odigrano. */
  groupMatchesRemaining: number;
  /** Utakmice završnice te konkurencije. */
  matches: FinalsMatch[];
};

function outcome(m: FinalsMatch | undefined): { winner: string; loser: string } | null {
  if (!m || m.status !== 'finished' || !m.home_team_id || !m.away_team_id) return null;
  if (m.home_score === m.away_score) return null;
  const homeWon = m.home_score > m.away_score;
  return {
    winner: homeWon ? m.home_team_id : m.away_team_id,
    loser: homeWon ? m.away_team_id : m.home_team_id,
  };
}

/**
 * Ekipe koje prolaze, redom nositelja. Null dok grupna faza nije gotova ili
 * neka grupa nema dovoljno ekipa.
 *
 * Nositelji: prvo svi prvoplasirani, pa svi drugoplasirani…, unutar istog
 * mjesta po bodovima, gol-razlici i golovima; lucky loseri su uvijek zadnji.
 */
export function resolveQualifiers(input: PlanFinalsInput): {
  seeds: string[];
  lucky: string[];
  byRef: (ref: Extract<SlotRef, { kind: 'group' }>) => string | null;
} | null {
  const { cfg, groups, groupMatchesRemaining } = input;
  if (groupMatchesRemaining > 0) return null;
  const adv = cfg.advancePerGroup;
  if (groups.some((g) => g.length < adv)) return null;

  const qualified: StandingRow[] = [];
  for (let rank = 1; rank <= adv; rank++) {
    const tier = groups.map((g) => g[rank - 1]!).sort(compareAcross);
    qualified.push(...tier);
  }
  const lucky = groups
    .map((g) => g[adv])
    .filter((r): r is StandingRow => !!r)
    .sort(compareAcross)
    .slice(0, cfg.luckyLosers)
    .map((r) => r.teamId);
  if (lucky.length < cfg.luckyLosers) return null;

  return {
    seeds: [...qualified.map((r) => r.teamId), ...lucky],
    lucky,
    byRef: (ref) => groups[ref.group]?.[ref.rank - 1]?.teamId ?? null,
  };
}

/**
 * Što upisati u utakmice završnice.
 *
 * Upisuje se samo na PRAZNA mjesta: ekipu koju je organizator postavio ručno
 * (lucky loser po vlastitoj odluci, ždrijeb, odustajanje) plan nikad ne
 * pregazi — samo javi da se razlikuje od ljestvice. Utakmica koja je počela
 * se ne dira.
 */
export function planFinals(input: PlanFinalsInput): FinalsPlan {
  const { cfg, groups, groupMatchesRemaining, matches } = input;
  const slots = finalsSlots(cfg, groups.length);
  const patches: KnockoutPatch[] = [];
  const blockers: FinalsBlocker[] = [];
  const notes: FinalsNote[] = [];

  if (!finalsInSync(slots, matches)) blockers.push({ key: 'out_of_sync' });
  if (groupMatchesRemaining > 0) {
    blockers.push({ key: 'groups_unfinished', remaining: groupMatchesRemaining });
  } else {
    groups.forEach((g, i) => {
      if (g.length < cfg.advancePerGroup) blockers.push({ key: 'group_short', group: groupLetter(i) });
    });
  }

  const q = resolveQualifiers(input);
  const bySlot = new Map(matches.filter((m) => m.finals_slot).map((m) => [m.finals_slot!, m]));
  let drawNeeded = false;
  let semiDrawn = false;
  let semiPending = false;

  const resolve = (ref: SlotRef): string | null => {
    switch (ref.kind) {
      case 'group':
        return q ? q.byRef(ref) : null;
      case 'lucky':
        return q?.lucky[ref.n - 1] ?? null;
      case 'seed':
        return q?.seeds[ref.n - 1] ?? null;
      case 'draw':
        return null;
      case 'winner':
      case 'loser': {
        const sf = bySlot.get(ref.slot);
        const o = outcome(sf);
        if (!o) {
          if (sf?.status === 'finished' && sf.home_team_id && sf.away_team_id) semiDrawn = true;
          else if (q) semiPending = true;
          return null;
        }
        return ref.kind === 'winner' ? o.winner : o.loser;
      }
    }
  };

  // Ždrijeb se ne može izračunati: dok organizator ne izvuče (ili ne upiše
  // ručno), mjesta s oznakom "Ždrijeb" ostaju prazna.
  if (q && slots.some((s) => s.home.kind === 'draw' || s.away.kind === 'draw')) {
    const sf1 = bySlot.get('sf1');
    const fin = bySlot.get('final');
    drawNeeded =
      (!!sf1 && sf1.status === 'scheduled' && (!sf1.home_team_id || !sf1.away_team_id)) ||
      (!!fin && fin.status === 'scheduled' && !fin.home_team_id);
  }

  for (const slot of slots) {
    const m = bySlot.get(slot.key);
    if (!m || m.status !== 'scheduled') continue;
    const expHome = resolve(slot.home);
    const expAway = resolve(slot.away);

    const home = m.home_team_id ?? expHome;
    const away = m.away_team_id ?? expAway;
    if (home !== m.home_team_id || away !== m.away_team_id) {
      patches.push({ id: m.id, home_team_id: home, away_team_id: away });
    }
    if (m.home_team_id && expHome && m.home_team_id !== expHome) {
      notes.push({ matchId: m.id, side: 'home', expectedTeamId: expHome });
    }
    if (m.away_team_id && expAway && m.away_team_id !== expAway) {
      notes.push({ matchId: m.id, side: 'away', expectedTeamId: expAway });
    }
  }

  if (drawNeeded) blockers.push({ key: 'draw_needed' });
  if (semiDrawn) blockers.push({ key: 'semifinal_drawn' });
  else if (semiPending) blockers.push({ key: 'semifinal_unfinished' });

  return { patches, blockers, notes };
}

/**
 * Ždrijeb za slobodan prolaz kod tri ekipe: jedna ide ravno u finale, druge
 * dvije igraju polufinale. `random` se predaje izvana zbog testova.
 */
export function drawBye(
  teamIds: readonly [string, string, string],
  random: () => number = Math.random
): { bye: string; semi: [string, string] } {
  const pool = [...teamIds];
  const pick = pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0]!;
  // Domaćin u polufinalu također ždrijebom, da ni to ne ovisi o redoslijedu.
  if (random() < 0.5) pool.reverse();
  return { bye: pick, semi: [pool[0]!, pool[1]!] };
}

// ── Tablica završne skupine ────────────────────────────────────────────────

export type FinalGroupRow = StandingRow & {
  /** Oznaka mjesta ("Pobjednik A") — za red čija ekipa još nije poznata. */
  placeholder: string | null;
};

export type FinalGroupMatchLike = {
  finals_slot?: string | null;
  stage: Stage;
  home_team_id: string | null;
  away_team_id: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number;
  away_score: number;
  status: 'scheduled' | 'live' | 'finished';
};

/**
 * Tablica završne skupine jedne konkurencije, ili null kad je nema.
 *
 * Ekipa NE pripada završnoj skupini preko polja na ekipi (ono pokazuje njezinu
 * grupu) nego preko utakmica koje u njoj igra. Mjesto se prati po oznaci
 * ("Pobjednik A"), pa red postoji i prije nego je ekipa poznata.
 *
 * Kod prenošenja rezultata u tablicu ulazi i grupna utakmica dviju ekipa iz
 * iste grupe — one se u završnoj skupini ne sreću ponovno.
 */
export function finalGroupTable<M extends FinalGroupMatchLike>(input: {
  matches: M[];
  teams: { id: string; name: string; group_id: string | null }[];
  points: Omit<PointsConfig, 'advancePerGroup'>;
  rematchRule: RematchRule;
}): { rows: FinalGroupRow[]; played: number; total: number; complete: boolean } | null {
  const fg = input.matches.filter(isFinalGroupMatch);
  if (fg.length === 0) return null;

  // Oznaka → ekipa (prva poznata), redom pojavljivanja.
  const byLabel = new Map<string, string | null>();
  const note = (label: string | null, teamId: string | null) => {
    if (!label) return;
    if (!byLabel.has(label) || (!byLabel.get(label) && teamId)) byLabel.set(label, teamId);
  };
  for (const m of fg) {
    note(m.home_placeholder, m.home_team_id);
    note(m.away_placeholder, m.away_team_id);
  }
  // Utakmica s ekipom a bez oznake (ručno dodana) — ekipa je i dalje sudionik.
  const known = new Set<string>([...byLabel.values()].filter((v): v is string => !!v));
  for (const m of fg) {
    for (const id of [m.home_team_id, m.away_team_id]) {
      if (id && !known.has(id)) {
        known.add(id);
        byLabel.set(`#${id}`, id);
      }
    }
  }

  const teamIndex = new Map(input.teams.map((t) => [t.id, t] as const));
  const resolved = [...known].map((id) => ({ id, name: teamIndex.get(id)?.name ?? '?' }));

  const counted: Pick<M, 'home_team_id' | 'away_team_id' | 'home_score' | 'away_score' | 'status'>[] = [...fg];
  if (input.rematchRule === 'carry') {
    for (const m of input.matches) {
      if (m.stage !== 'group' || m.finals_slot || !m.home_team_id || !m.away_team_id) continue;
      if (!known.has(m.home_team_id) || !known.has(m.away_team_id)) continue;
      const g1 = teamIndex.get(m.home_team_id)?.group_id;
      const g2 = teamIndex.get(m.away_team_id)?.group_id;
      if (g1 && g1 === g2) counted.push(m);
    }
  }

  const standings = computeStandings(resolved, counted, { ...input.points, advancePerGroup: 0 });
  const labelOf = new Map<string, string>();
  for (const [label, id] of byLabel) if (id && !label.startsWith('#')) labelOf.set(id, label);

  const rows: FinalGroupRow[] = standings.map((r) => ({ ...r, placeholder: labelOf.get(r.teamId) ?? null }));
  for (const [label, id] of byLabel) {
    if (id) continue;
    rows.push({
      teamId: '',
      teamName: label,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      rank: rows.length + 1,
      qualifies: false,
      placeholder: label,
    });
  }

  const played = fg.filter((m) => m.status === 'finished').length;
  return { rows, played, total: fg.length, complete: played === fg.length };
}
