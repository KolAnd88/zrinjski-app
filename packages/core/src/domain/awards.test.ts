import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../types/database';
import {
  eligibleCandidates,
  tallyVotes,
  tournamentAwards,
  winnerOf,
} from './awards';

type Ev = Pick<MatchEvent, 'player_id' | 'type'>;
const ev = (player_id: string | null, type: MatchEvent['type']): Ev => ({ player_id, type });
const vote = (player_id: string) => ({ player_id });

describe('tallyVotes', () => {
  it('broji glasove i rangira od najviše prema najmanje', () => {
    const rows = tallyVotes([vote('a'), vote('b'), vote('a'), vote('c'), vote('a'), vote('b')]);
    expect(rows).toEqual([
      { playerId: 'a', count: 3, rank: 1 },
      { playerId: 'b', count: 2, rank: 2 },
      { playerId: 'c', count: 1, rank: 3 },
    ]);
  });

  it('prazno glasanje daje praznu listu', () => {
    expect(tallyVotes([])).toEqual([]);
  });

  it('isti broj glasova rangira stabilno, ne nasumično', () => {
    const a = tallyVotes([vote('z'), vote('a')]);
    const b = tallyVotes([vote('a'), vote('z')]);
    expect(a.map((r) => r.playerId)).toEqual(b.map((r) => r.playerId));
  });
});

describe('winnerOf', () => {
  it('vraća vrh liste bez neodlučenog', () => {
    const w = winnerOf(tallyVotes([vote('a'), vote('a'), vote('b')]));
    expect(w).toEqual({ playerId: 'a', count: 2, tied: ['a'] });
  });

  it('kod neodlučenog nabraja sve na vrhu', () => {
    const w = winnerOf(tallyVotes([vote('a'), vote('b')]));
    expect(w?.count).toBe(1);
    expect(w?.tied.sort()).toEqual(['a', 'b']);
  });

  it('prazna lista nema pobjednika', () => {
    expect(winnerOf([])).toBeNull();
  });
});

describe('tournamentAwards', () => {
  const events: Ev[] = [
    ev('p1', 'goal'),
    ev('p1', 'goal'),
    ev('p2', 'goal'),
    ev('g1', 'save'),
    ev('g1', 'save'),
    ev('g1', 'save'),
    ev('g2', 'save'),
    ev('p1', 'red_card'),
    ev(null, 'goal'), // gol bez igrača (npr. brzi unos) ne smije srušiti brojanje
  ];

  it('golman i strijelac dolaze iz događaja, bez glasanja', () => {
    const a = tournamentAwards(events, []);
    expect(a.topScorer).toMatchObject({ playerId: 'p1', count: 2 });
    expect(a.topKeeper).toMatchObject({ playerId: 'g1', count: 3 });
    expect(a.mvp).toBeNull();
  });

  it('najbolji igrač dolazi iz glasova, ne iz golova', () => {
    const a = tournamentAwards(events, [vote('p2'), vote('p2'), vote('g2')]);
    expect(a.mvp).toMatchObject({ playerId: 'p2', count: 2 });
    expect(a.topScorer?.playerId).toBe('p1'); // strijelac ostaje neovisan o glasanju
  });

  it('bez ijednog događaja nema automatskih nagrada', () => {
    const a = tournamentAwards([], [vote('p1')]);
    expect(a.topScorer).toBeNull();
    expect(a.topKeeper).toBeNull();
    expect(a.mvp).toMatchObject({ playerId: 'p1', count: 1 });
  });
});

describe('eligibleCandidates', () => {
  const teams = [
    { id: 't1', gender: 'm' },
    { id: 't2', gender: 'm' },
    { id: 't3', gender: 'z' },
  ];
  const players = [
    { id: 'p1', team_id: 't1', name: 'Ante', number: 1 },
    { id: 'p2', team_id: 't2', name: 'Boris', number: 2 },
    { id: 'p3', team_id: 't3', name: 'Cvita', number: 3 },
  ];

  it('izbacuje vlastitu ekipu', () => {
    const out = eligibleCandidates(players, teams, 'm', 't1');
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  it('izbacuje drugu konkurenciju', () => {
    const out = eligibleCandidates(players, teams, 'z', null);
    expect(out.map((p) => p.id)).toEqual(['p3']);
  });

  it('bez vlastite ekipe (admin pregled) vraća cijelu konkurenciju', () => {
    const out = eligibleCandidates(players, teams, 'm', null);
    expect(out.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('predstavnik jedine ekipe u konkurenciji nema za koga glasati', () => {
    const out = eligibleCandidates(players, teams, 'z', 't3');
    expect(out).toEqual([]);
  });
});
