// knockout.ts — postavljanje ekipa u završnicu.
//
// Bracket se dosad samo CRTAO: `buildBracket` je računao tko ide u polufinale,
// ali to nitko nije zapisivao u bazu. Polufinale je zato zauvijek ostajalo
// "A1 vs B2" — zapisničar bi ga otvorio i ne bi imao koga upisati, jer
// utakmica nema ekipa ni sastava. Turnir se doslovno nije mogao odigrati do
// kraja.
//
// Ovdje se iz ljestvica i odigranih polufinala izvodi popis izmjena koje
// treba upisati na postojeće utakmice završnice.

import type { Gender, Stage } from '../types/database';
import type { StandingRow } from './standings';

/** Utakmica onako kako je treba ovaj izračun — podskup reda iz baze. */
export type KnockoutMatch = {
  id: string;
  gender: Gender;
  stage: Stage;
  sort_order: number;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  status: 'scheduled' | 'live' | 'finished';
};

export type KnockoutPatch = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
};

/** Zašto se neka utakmica NIJE mogla postaviti — za poruku u sučelju. */
export type KnockoutBlocker =
  | { key: 'no_semifinals' }
  | { key: 'no_final' }
  | { key: 'no_third' }
  | { key: 'groups_unfinished'; remaining: number }
  | { key: 'not_enough_teams'; group: 'A' | 'B' }
  | { key: 'semifinal_drawn'; matchId: string }
  | { key: 'semifinal_unfinished' }
  | { key: 'already_started'; matchId: string };

export type KnockoutPlan = {
  /** Izmjene koje treba upisati. Prazno kad nema što mijenjati. */
  patches: KnockoutPatch[];
  /** Razlozi zbog kojih dio završnice ostaje nepopunjen. */
  blockers: KnockoutBlocker[];
};

/**
 * Ishod odigranog polufinala.
 * `null` kad utakmica nije završena, nema obje ekipe ili je neriješena —
 * neriješeno u završnici aplikacija ne zna razriješiti (nema jedanaesteraca),
 * pa se to mora reći, a ne tiho pogoditi.
 */
export function semifinalOutcome(
  m: KnockoutMatch
): { winnerTeamId: string; loserTeamId: string } | null {
  if (m.status !== 'finished') return null;
  if (!m.home_team_id || !m.away_team_id) return null;
  if (m.home_score === m.away_score) return null;
  const homeWon = m.home_score > m.away_score;
  return {
    winnerTeamId: homeWon ? m.home_team_id : m.away_team_id,
    loserTeamId: homeWon ? m.away_team_id : m.home_team_id,
  };
}

export type PlanKnockoutInput = {
  gender: Gender;
  /** Sve utakmice te konkurencije (grupne i završnica). */
  matches: KnockoutMatch[];
  /** Ljestvica grupe A i B, već izračunata i sortirana. */
  groupA: StandingRow[];
  groupB: StandingRow[];
};

/**
 * Izvedi izmjene za završnicu.
 *
 * Pravila koja se NE smiju prekršiti:
 *  • utakmica koja je počela ili je odigrana se ne dira — inače bi se
 *    rezultat prepisao na krive ekipe;
 *  • polufinala se postavljaju tek kad su SVE grupne utakmice odigrane, jer
 *    je do tada ljestvica privremena;
 *  • finale i utakmica za 3. mjesto tek kad su oba polufinala odigrana.
 */
export function planKnockout(input: PlanKnockoutInput): KnockoutPlan {
  const { gender, matches, groupA, groupB } = input;
  const mine = matches.filter((m) => m.gender === gender);
  const byStage = (s: Stage) =>
    mine.filter((m) => m.stage === s).sort((a, b) => a.sort_order - b.sort_order);

  const patches: KnockoutPatch[] = [];
  const blockers: KnockoutBlocker[] = [];

  /** Doda izmjenu ako se utakmica smije dirati i ako se stvarno mijenja. */
  const put = (m: KnockoutMatch | undefined, home: string | null, away: string | null) => {
    if (!m) return;
    if (m.status !== 'scheduled') {
      blockers.push({ key: 'already_started', matchId: m.id });
      return;
    }
    if (m.home_team_id === home && m.away_team_id === away) return;
    patches.push({ id: m.id, home_team_id: home, away_team_id: away });
  };

  // ── Polufinala ───────────────────────────────────────────────────────────
  const semis = byStage('semifinal');
  const groupMatches = mine.filter((m) => m.stage === 'group');
  const unfinished = groupMatches.filter((m) => m.status !== 'finished').length;

  if (semis.length < 2) {
    blockers.push({ key: 'no_semifinals' });
  } else if (unfinished > 0) {
    blockers.push({ key: 'groups_unfinished', remaining: unfinished });
  } else if (groupA.length < 2) {
    blockers.push({ key: 'not_enough_teams', group: 'A' });
  } else if (groupB.length < 2) {
    blockers.push({ key: 'not_enough_teams', group: 'B' });
  } else {
    // Ustaljeni raspored: prvak grupe protiv drugoplasiranog druge grupe.
    put(semis[0], groupA[0]!.teamId, groupB[1]!.teamId);
    put(semis[1], groupA[1]!.teamId, groupB[0]!.teamId);
  }

  // ── Finale i 3. mjesto ───────────────────────────────────────────────────
  const fin = byStage('final')[0];
  const third = byStage('third_place')[0];
  if (!fin) blockers.push({ key: 'no_final' });
  if (!third) blockers.push({ key: 'no_third' });

  if (semis.length >= 2) {
    const o1 = semifinalOutcome(semis[0]!);
    const o2 = semifinalOutcome(semis[1]!);
    for (const [m, o] of [
      [semis[0]!, o1],
      [semis[1]!, o2],
    ] as const) {
      if (m.status === 'finished' && !o && m.home_team_id && m.away_team_id) {
        blockers.push({ key: 'semifinal_drawn', matchId: m.id });
      }
    }
    if (o1 && o2) {
      put(fin, o1.winnerTeamId, o2.winnerTeamId);
      put(third, o1.loserTeamId, o2.loserTeamId);
    } else {
      blockers.push({ key: 'semifinal_unfinished' });
    }
  }

  return { patches, blockers };
}

/** Utakmica završnice koju treba tek napraviti. */
export type KnockoutSeed = {
  stage: Extract<Stage, 'semifinal' | 'third_place' | 'final'>;
  home_placeholder: string;
  away_placeholder: string;
};

/**
 * Koje utakmice završnice nedostaju.
 *
 * Turnir se sastoji od dvije grupe pa završnice; utakmice završnice moraju
 * postojati PRIJE nego se u njih upišu ekipe, a generiranje grupnih ih nikad
 * nije stvaralo. Na novom turniru ih zato nije imao tko napraviti.
 *
 * Oznake su iste one koje bracket već koristi, da se prije ždrijeba vidi
 * smislen raspored umjesto praznih redaka.
 */
export function missingKnockoutMatches(
  matches: Pick<KnockoutMatch, 'gender' | 'stage'>[],
  gender: Gender
): KnockoutSeed[] {
  const have = (s: Stage) => matches.filter((m) => m.gender === gender && m.stage === s).length;
  const out: KnockoutSeed[] = [];

  // Polufinala su dva; ako postoji samo jedno, dodaje se ono koje fali.
  const semis = have('semifinal');
  if (semis < 1) out.push({ stage: 'semifinal', home_placeholder: 'A1', away_placeholder: 'B2' });
  if (semis < 2) out.push({ stage: 'semifinal', home_placeholder: 'A2', away_placeholder: 'B1' });
  if (have('third_place') < 1)
    out.push({ stage: 'third_place', home_placeholder: 'Poraženi PF1', away_placeholder: 'Poraženi PF2' });
  if (have('final') < 1)
    out.push({ stage: 'final', home_placeholder: 'Pobjednik PF1', away_placeholder: 'Pobjednik PF2' });

  return out;
}

/** Utakmica završnice za prikaz — spojene stvarne ekipe i oznake. */
export type KnockoutView = {
  id: string;
  stage: Extract<Stage, 'semifinal' | 'third_place' | 'final'>;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** Tekst kad ekipa još nije poznata ("A1", "Pobjednik PF1"). */
  homePlaceholder: string;
  awayPlaceholder: string;
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'live' | 'finished';
};

type RowForView = KnockoutMatch & {
  home_placeholder?: string | null;
  away_placeholder?: string | null;
};

/**
 * Završnica ONAKO KAKO STOJI U BAZI, za prikaz gledateljima.
 *
 * Aplikacija je bracket dosad računala iz ljestvica i pokazivala pretpostavku.
 * Ta pretpostavka se razilazi sa stvarnošću čim organizator nešto promijeni
 * ručno, a finale i 3. mjesto ostajali su zauvijek prazni jer se izvode iz
 * odigranih polufinala, a ne iz tablica. Ovdje se čitaju stvarni redovi, s
 * rezultatom i statusom.
 *
 * Redoslijed je onaj u kojem se igra: polufinala, pa 3. mjesto, pa finale.
 */
const STAGE_ORDER: Record<string, number> = { semifinal: 0, third_place: 1, final: 2 };

export function knockoutView(matches: RowForView[], gender: Gender): KnockoutView[] {
  return matches
    .filter(
      (m): m is RowForView & { stage: KnockoutView['stage'] } =>
        m.gender === gender && m.stage !== 'group'
    )
    .sort(
      (a, b) =>
        (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) || a.sort_order - b.sort_order
    )
    .map((m) => ({
      id: m.id,
      stage: m.stage,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homePlaceholder: m.home_placeholder ?? '?',
      awayPlaceholder: m.away_placeholder ?? '?',
      homeScore: m.home_score,
      awayScore: m.away_score,
      status: m.status,
    }));
}
