import { describe, expect, it } from 'vitest';
import { computeStandings, qualifiers, type PointsConfig } from './standings';
import type { Match } from '../types/database';

const cfg: PointsConfig = { pointsWin: 2, pointsDraw: 1, pointsLoss: 0, advancePerGroup: 2 };

const T = (id: string, name: string) => ({ id, name });

function m(home: string, away: string, hs: number, as: number, status: Match['status'] = 'finished') {
  return { home_team_id: home, away_team_id: away, home_score: hs, away_score: as, status };
}

describe('computeStandings', () => {
  it('bodovanje 2/1/0 i brojači', () => {
    const teams = [T('a', 'Alfa'), T('b', 'Beta'), T('c', 'Gama')];
    const rows = computeStandings(
      teams,
      [
        m('a', 'b', 3, 1), // a pobjeda
        m('b', 'c', 2, 2), // neriješeno
        m('a', 'c', 0, 1), // c pobjeda
      ],
      cfg
    );
    const byId = Object.fromEntries(rows.map((r) => [r.teamId, r]));
    expect(byId.a).toMatchObject({ played: 2, wins: 1, draws: 0, losses: 1, points: 2 });
    expect(byId.b).toMatchObject({ played: 2, wins: 0, draws: 1, losses: 1, points: 1 });
    expect(byId.c).toMatchObject({ played: 2, wins: 1, draws: 1, losses: 0, points: 3 });
  });

  it('sortiranje: bodovi → gol-razlika → postignuti golovi', () => {
    const teams = [T('a', 'Alfa'), T('b', 'Beta'), T('c', 'Gama'), T('d', 'Delta')];
    // a i b imaju po 2 boda; a ima bolju gol-razliku.
    // c i d imaju po 0/... — c i b test za golove.
    const rows = computeStandings(
      teams,
      [
        m('a', 'c', 5, 0), // a: +5
        m('b', 'd', 1, 0), // b: +1
      ],
      cfg
    );
    expect(rows.map((r) => r.teamId).slice(0, 2)).toEqual(['a', 'b']);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[1]!.rank).toBe(2);
  });

  it('ista gol-razlika → više postignutih golova ide gore', () => {
    const teams = [T('a', 'Alfa'), T('b', 'Beta'), T('x', 'Iks'), T('y', 'Ipsilon')];
    const rows = computeStandings(
      teams,
      [
        m('a', 'x', 4, 2), // a: GR +2, GF 4
        m('b', 'y', 2, 0), // b: GR +2, GF 2
      ],
      cfg
    );
    expect(rows[0]!.teamId).toBe('a');
    expect(rows[1]!.teamId).toBe('b');
  });

  it('prve advance_per_group prolaze (qualifies)', () => {
    const teams = [T('a', 'Alfa'), T('b', 'Beta'), T('c', 'Gama')];
    const rows = computeStandings(teams, [m('a', 'b', 2, 0), m('a', 'c', 2, 0), m('b', 'c', 1, 0)], cfg);
    expect(rows.filter((r) => r.qualifies).length).toBe(2);
    expect(qualifiers(rows).map((r) => r.teamId)).toEqual(['a', 'b']);
  });

  it('ignorira nezavršene utakmice i utakmice izvan skupa ekipa', () => {
    const teams = [T('a', 'Alfa'), T('b', 'Beta')];
    const rows = computeStandings(
      teams,
      [
        m('a', 'b', 9, 0, 'live'), // uživo — ne broji se
        m('a', 'b', 9, 0, 'scheduled'), // najavljena — ne broji se
        m('a', 'z', 9, 0), // 'z' nije u skupu — ne broji se
      ],
      cfg
    );
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });
});
