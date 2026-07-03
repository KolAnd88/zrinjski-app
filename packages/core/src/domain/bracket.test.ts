import { describe, expect, it } from 'vitest';
import { buildBracket, resolveKnockout } from './bracket';
import type { StandingRow } from './standings';

function row(teamId: string, rank: number): StandingRow {
  return {
    teamId,
    teamName: teamId.toUpperCase(),
    played: 5,
    wins: 5 - rank,
    draws: 0,
    losses: rank - 1,
    goalsFor: 10,
    goalsAgainst: 5,
    goalDiff: 5,
    points: (5 - rank) * 2,
    rank,
    qualifies: rank <= 2,
  };
}

const groupA = [row('a1', 1), row('a2', 2), row('a3', 3)];
const groupB = [row('b1', 1), row('b2', 2), row('b3', 3)];

describe('buildBracket', () => {
  it('polufinala su A1–B2 i A2–B1', () => {
    const br = buildBracket({ gender: 'm', groupA, groupB });
    const pf1 = br.find((x) => x.key === 'pf1')!;
    const pf2 = br.find((x) => x.key === 'pf2')!;
    expect(pf1.home.teamId).toBe('a1');
    expect(pf1.away.teamId).toBe('b2');
    expect(pf2.home.teamId).toBe('a2');
    expect(pf2.away.teamId).toBe('b1');
  });

  it('finale i za-3. su placeholderi dok se polufinala ne odigraju', () => {
    const br = buildBracket({ gender: 'm', groupA, groupB });
    const fin = br.find((x) => x.key === 'final')!;
    const third = br.find((x) => x.key === 'third')!;
    expect(fin.home.teamId).toBeNull();
    expect(fin.home.placeholder).toBe('Pobjednik PF1');
    expect(third.away.placeholder).toBe('Poraženi PF2');
  });

  it('prekratka grupa → placeholder umjesto ekipe', () => {
    const br = buildBracket({ gender: 'z', groupA: [row('x1', 1)], groupB: [] });
    const pf1 = br.find((x) => x.key === 'pf1')!;
    expect(pf1.home.teamId).toBe('x1');
    expect(pf1.away.teamId).toBeNull();
    expect(pf1.away.placeholder).toBe('B2');
  });
});

describe('resolveKnockout', () => {
  it('pobjednici u finale, poraženi u utakmicu za 3. mjesto', () => {
    const br = buildBracket({ gender: 'm', groupA, groupB });
    const done = resolveKnockout(br, {
      pf1: { winnerTeamId: 'a1', loserTeamId: 'b2' },
      pf2: { winnerTeamId: 'b1', loserTeamId: 'a2' },
    });
    const fin = done.find((x) => x.key === 'final')!;
    const third = done.find((x) => x.key === 'third')!;
    expect([fin.home.teamId, fin.away.teamId]).toEqual(['a1', 'b1']);
    expect([third.home.teamId, third.away.teamId]).toEqual(['b2', 'a2']);
  });

  it('djelomični rezultati: samo odigrano polufinale se popuni', () => {
    const br = buildBracket({ gender: 'm', groupA, groupB });
    const done = resolveKnockout(br, { pf1: { winnerTeamId: 'a1', loserTeamId: 'b2' } });
    const fin = done.find((x) => x.key === 'final')!;
    expect(fin.home.teamId).toBe('a1');
    expect(fin.away.teamId).toBeNull();
  });
});
