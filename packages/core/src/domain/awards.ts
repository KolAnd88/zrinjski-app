// awards.ts — nagrade turnira.
//
// Tri nagrade po konkurenciji (M i Ž odvojeno):
//   • Najbolji igrač   — GLASANJE predstavnika ekipa (jedan glas po predstavniku).
//   • Najbolji golman  — AUTOMATSKI, najviše obrana (event 'save').
//   • Najbolji strijelac — AUTOMATSKI, najviše golova (event 'goal').
//
// Kao i u stats.ts, `events` mora već biti filtriran na utakmice odgovarajućeg
// spola — ovdje se spol ne gleda.
//
// Neodlučeno se NE razrješava nasumično. Kad dva igrača imaju isti broj golova,
// oboje su na vrhu i organizator odlučuje (ili se dodijele dvije nagrade).

import type { Gender, MatchEvent } from '../types/database';
import { rankByEvent, type StatRow } from './stats';

/** Redak koji vraća RPC `mvp_results()` — zbrojeni glasovi, bez identiteta glasača. */
export type MvpResult = { player_id: string; gender: Gender; votes: number };

export type AwardWinner = {
  /** Pobjednik; kod neodlučenog prvi po abecedi ulaza, a `tied` nabraja sve. */
  playerId: string;
  /** Golovi, obrane ili glasovi — ovisno o nagradi. */
  count: number;
  /** Svi igrači koji dijele vrh (uključujući `playerId`). Duljina 1 = nema neodlučenog. */
  tied: string[];
};

export type VoteRow = { player_id: string };

/**
 * Prebroji glasove i rangiraj. Isti oblik kao statistika (StatRow) da se
 * lista glasova može prikazati istim komponentama kao lista strijelaca.
 */
export function tallyVotes(votes: VoteRow[]): StatRow[] {
  const counts = new Map<string, number>();
  for (const v of votes) {
    if (!v.player_id) continue;
    counts.set(v.player_id, (counts.get(v.player_id) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([playerId, count]) => ({ playerId, count, rank: 0 }))
    .sort((a, b) => b.count - a.count || a.playerId.localeCompare(b.playerId));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

/** Vrh rang-liste kao nagrada, ili null ako lista je prazna. */
export function winnerOf(rows: StatRow[]): AwardWinner | null {
  const top = rows[0];
  if (!top) return null;
  const tied = rows.filter((r) => r.count === top.count).map((r) => r.playerId);
  return { playerId: top.playerId, count: top.count, tied };
}

export type TournamentAwards = {
  /** null dok nitko nije glasao. */
  mvp: AwardWinner | null;
  topKeeper: AwardWinner | null;
  topScorer: AwardWinner | null;
};

/** Sve tri nagrade jedne konkurencije. */
export function tournamentAwards(
  events: Pick<MatchEvent, 'player_id' | 'type'>[],
  votes: VoteRow[]
): TournamentAwards {
  return {
    mvp: winnerOf(tallyVotes(votes)),
    topKeeper: winnerOf(rankByEvent(events, 'goalkeepers')),
    topScorer: winnerOf(rankByEvent(events, 'scorers')),
  };
}

type CandidatePlayer = { id: string; team_id: string; name: string; number: number | null };
type CandidateTeam = { id: string; gender: string };

/**
 * Igrači za koje predstavnik smije glasati: samo njegova konkurencija (spol),
 * i nikad vlastita ekipa — inače bi ekipe same sebi dodjeljivale nagradu.
 */
export function eligibleCandidates(
  players: CandidatePlayer[],
  teams: CandidateTeam[],
  gender: string,
  ownTeamId: string | null
): CandidatePlayer[] {
  const allowed = new Set(
    teams.filter((t) => t.gender === gender && t.id !== ownTeamId).map((t) => t.id)
  );
  return players.filter((p) => allowed.has(p.team_id));
}
