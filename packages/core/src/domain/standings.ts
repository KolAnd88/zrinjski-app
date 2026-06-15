// standings.ts — bodovanje i ljestvica.
//
// Bodovanje: pobjeda = points_win (2), neriješeno = points_draw (1), poraz = points_loss (0).
// Sortiranje: bodovi → gol-razlika → postignuti golovi → (naziv, stabilno).
// Prve `advance_per_group` ekipe prolaze u završnicu.

import type { Match, Team } from '../types/database';

export type PointsConfig = {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  advancePerGroup: number;
};

export type StandingRow = {
  teamId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Pozicija u grupi, 1-baziran (popunjava se nakon sortiranja). */
  rank: number;
  /** Prolazi li u završnicu (rank <= advancePerGroup). */
  qualifies: boolean;
};

type Mutable = Omit<StandingRow, 'rank' | 'qualifies' | 'goalDiff'>;

/**
 * Izračunaj ljestvicu za skup ekipa iz odigranih (finished) utakmica.
 * Uzima u obzir samo utakmice gdje su obje ekipe iz `teams` i status === 'finished'.
 */
export function computeStandings(
  teams: Pick<Team, 'id' | 'name'>[],
  matches: Pick<
    Match,
    'home_team_id' | 'away_team_id' | 'home_score' | 'away_score' | 'status'
  >[],
  config: PointsConfig
): StandingRow[] {
  const rows = new Map<string, Mutable>();
  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== 'finished') continue;
    if (!m.home_team_id || !m.away_team_id) continue;
    const home = rows.get(m.home_team_id);
    const away = rows.get(m.away_team_id);
    if (!home || !away) continue; // utakmica nije unutar ovog skupa ekipa

    const hs = m.home_score;
    const as = m.away_score;
    home.played++; away.played++;
    home.goalsFor += hs; home.goalsAgainst += as;
    away.goalsFor += as; away.goalsAgainst += hs;

    if (hs > as) {
      home.wins++; home.points += config.pointsWin;
      away.losses++; away.points += config.pointsLoss;
    } else if (hs < as) {
      away.wins++; away.points += config.pointsWin;
      home.losses++; home.points += config.pointsLoss;
    } else {
      home.draws++; away.draws++;
      home.points += config.pointsDraw;
      away.points += config.pointsDraw;
    }
  }

  const result: StandingRow[] = [...rows.values()].map((r) => ({
    ...r,
    goalDiff: r.goalsFor - r.goalsAgainst,
    rank: 0,
    qualifies: false,
  }));

  result.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamName.localeCompare(b.teamName, 'hr')
  );

  result.forEach((row, i) => {
    row.rank = i + 1;
    row.qualifies = i < config.advancePerGroup;
  });

  return result;
}

/** Ekipe koje prolaze iz grupe (po redu plasmana). */
export function qualifiers(standings: StandingRow[]): StandingRow[] {
  return standings.filter((r) => r.qualifies);
}
