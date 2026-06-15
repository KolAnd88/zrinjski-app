// bracket.ts — završnica (knockout).
//
// Standardni format za 2 grupe: polufinala A1–B2 i A2–B1, zatim finale + utakmica za 3.
// Funkcija gradi strukturu s placeholderima (npr. "Pobjednik PF1") koja se popunjava
// kako rezultati pristižu. Generička je: ako grupa nema dovoljno prolaznika, koristi placeholder.

import type { Gender, Stage } from '../types/database';
import type { StandingRow } from './standings';

export type BracketSlot = {
  teamId: string | null;
  /** Tekst kad ekipa još nije poznata (npr. "A1", "Pobjednik PF1"). */
  placeholder: string;
};

export type BracketMatch = {
  /** Stabilni ključ unutar bracketa (pf1, pf2, final, third). */
  key: 'pf1' | 'pf2' | 'final' | 'third';
  stage: Stage;
  gender: Gender;
  label: string;
  home: BracketSlot;
  away: BracketSlot;
};

export type BuildBracketInput = {
  gender: Gender;
  /** Ljestvica grupe A (sortirana) — koristi se A1, A2. */
  groupA: StandingRow[];
  /** Ljestvica grupe B (sortirana) — koristi se B1, B2. */
  groupB: StandingRow[];
};

function slot(rows: StandingRow[], rank: number, label: string): BracketSlot {
  const row = rows[rank - 1];
  return { teamId: row ? row.teamId : null, placeholder: label };
}

/**
 * Gradi polufinala (A1–B2, A2–B1), finale i utakmicu za 3. mjesto.
 * teamId u finalu/za-3. ostaje null dok polufinala nisu odigrana (popunjava se kasnije).
 */
export function buildBracket(input: BuildBracketInput): BracketMatch[] {
  const { gender, groupA, groupB } = input;

  const pf1: BracketMatch = {
    key: 'pf1',
    stage: 'semifinal',
    gender,
    label: 'Polufinale 1',
    home: slot(groupA, 1, 'A1'),
    away: slot(groupB, 2, 'B2'),
  };
  const pf2: BracketMatch = {
    key: 'pf2',
    stage: 'semifinal',
    gender,
    label: 'Polufinale 2',
    home: slot(groupA, 2, 'A2'),
    away: slot(groupB, 1, 'B1'),
  };
  const fin: BracketMatch = {
    key: 'final',
    stage: 'final',
    gender,
    label: 'Finale',
    home: { teamId: null, placeholder: 'Pobjednik PF1' },
    away: { teamId: null, placeholder: 'Pobjednik PF2' },
  };
  const third: BracketMatch = {
    key: 'third',
    stage: 'third_place',
    gender,
    label: 'Za 3. mjesto',
    home: { teamId: null, placeholder: 'Poraženi PF1' },
    away: { teamId: null, placeholder: 'Poraženi PF2' },
  };

  return [pf1, pf2, third, fin];
}

/**
 * Popuni finale i utakmicu za 3. mjesto na temelju ishoda polufinala.
 * Vraća novu listu (ne mutira ulaz).
 */
export function resolveKnockout(
  bracket: BracketMatch[],
  results: {
    pf1?: { winnerTeamId: string; loserTeamId: string };
    pf2?: { winnerTeamId: string; loserTeamId: string };
  }
): BracketMatch[] {
  return bracket.map((m) => {
    if (m.key === 'final') {
      return {
        ...m,
        home: results.pf1
          ? { teamId: results.pf1.winnerTeamId, placeholder: 'Pobjednik PF1' }
          : m.home,
        away: results.pf2
          ? { teamId: results.pf2.winnerTeamId, placeholder: 'Pobjednik PF2' }
          : m.away,
      };
    }
    if (m.key === 'third') {
      return {
        ...m,
        home: results.pf1
          ? { teamId: results.pf1.loserTeamId, placeholder: 'Poraženi PF1' }
          : m.home,
        away: results.pf2
          ? { teamId: results.pf2.loserTeamId, placeholder: 'Poraženi PF2' }
          : m.away,
      };
    }
    return m;
  });
}
