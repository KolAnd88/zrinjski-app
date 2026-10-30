import { describe, expect, it } from 'vitest';
import {
  defaultFinalsConfig,
  drawBye,
  finalGroupTable,
  finalsInSync,
  finalsSlots,
  planFinals,
  validateFinalsConfig,
  type FinalsConfig,
  type FinalsMatch,
} from './finals';
import type { StandingRow } from './standings';

const row = (teamId: string, rank: number, points = 0, goalDiff = 0, goalsFor = 0): StandingRow => ({
  teamId,
  teamName: teamId.toUpperCase(),
  rank,
  played: 2,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor,
  goalsAgainst: 0,
  goalDiff,
  points,
  qualifies: false,
});

const cfg = (p: Partial<FinalsConfig>): FinalsConfig => ({ ...defaultFinalsConfig(2), ...p });

/** Utakmice u bazi točno onakve kakve postavke traže. */
function matchesFor(c: FinalsConfig, groupCount: number): FinalsMatch[] {
  return finalsSlots(c, groupCount).map((s) => ({
    id: s.key,
    finals_slot: s.key,
    stage: s.stage,
    home_team_id: null,
    away_team_id: null,
    home_placeholder: s.homeLabel,
    away_placeholder: s.awayLabel,
    home_score: 0,
    away_score: 0,
    status: 'scheduled',
  }));
}

const pairs = (c: FinalsConfig, g: number) =>
  finalsSlots(c, g).map((s) => `${s.key}: ${s.homeLabel} – ${s.awayLabel}`);

describe('defaultFinalsConfig', () => {
  it('tri grupe → završna skupina pobjednika', () => {
    expect(defaultFinalsConfig(3)).toMatchObject({ format: 'group', advancePerGroup: 1 });
  });
  it('dvije grupe → polufinala s prve dvije', () => {
    expect(defaultFinalsConfig(2)).toMatchObject({ format: 'bracket', advancePerGroup: 2, thirdPlace: true });
  });
});

describe('finalsSlots — kostur', () => {
  it('muški: A1–B2 i B1–A2, 3. mjesto, finale', () => {
    expect(pairs(cfg({}), 2)).toEqual([
      'sf1: A1 – B2',
      'sf2: B1 – A2',
      'third: Poraženi PF1 – Poraženi PF2',
      'final: Pobjednik PF1 – Pobjednik PF2',
    ]);
  });

  it('bez utakmice za 3. mjesto', () => {
    expect(pairs(cfg({ thirdPlace: false }), 2)).toEqual([
      'sf1: A1 – B2',
      'sf2: B1 – A2',
      'final: Pobjednik PF1 – Pobjednik PF2',
    ]);
  });

  it('tri ekipe: najbolji nositelj ide ravno u finale, nema 3. mjesta', () => {
    expect(pairs(cfg({ advancePerGroup: 1, thirdPlace: true }), 3)).toEqual([
      'sf1: 2. nositelj – 3. nositelj',
      'final: 1. nositelj – Pobjednik PF',
    ]);
  });

  it('tri ekipe, ždrijeb za slobodan prolaz', () => {
    expect(pairs(cfg({ advancePerGroup: 1, byeRule: 'draw' }), 3)).toEqual([
      'sf1: Ždrijeb 1 – Ždrijeb 2',
      'final: Slobodan prolaz (ždrijeb) – Pobjednik PF',
    ]);
  });

  it('tri pobjednika + lucky loser = četiri, normalna polufinala', () => {
    expect(pairs(cfg({ advancePerGroup: 1, luckyLosers: 1 }), 3)).toEqual([
      'sf1: 1. nositelj – 4. nositelj',
      'sf2: 2. nositelj – 3. nositelj',
      'third: Poraženi PF1 – Poraženi PF2',
      'final: Pobjednik PF1 – Pobjednik PF2',
    ]);
  });

  it('dvije ekipe: odmah finale', () => {
    expect(pairs(cfg({ advancePerGroup: 1 }), 2)).toEqual(['final: A1 – B1']);
  });

  it('više od četiri ekipe u kosturu se ne slaže — nema četvrtfinala', () => {
    expect(finalsSlots(cfg({ advancePerGroup: 2 }), 3)).toEqual([]);
  });
});

describe('finalsSlots — završna skupina', () => {
  it('ženski: tri pobjednika grupa, svaka sa svakom', () => {
    const s = finalsSlots(defaultFinalsConfig(3), 3);
    expect(s).toHaveLength(3);
    expect(s.every((x) => x.stage === 'group')).toBe(true);
    const parovi = s.map((x) => [x.homeLabel, x.awayLabel].sort().join(' / ')).sort();
    expect(parovi).toEqual([
      'Pobjednik A / Pobjednik B',
      'Pobjednik A / Pobjednik C',
      'Pobjednik B / Pobjednik C',
    ]);
  });

  it('dvije iz svake grupe, igraju ponovno → 6 utakmica', () => {
    expect(finalsSlots(cfg({ format: 'group', advancePerGroup: 2 }), 2)).toHaveLength(6);
  });

  it('dvije iz svake grupe, prenosi se rezultat → A1–A2 i B1–B2 se ne igraju', () => {
    const s = finalsSlots(cfg({ format: 'group', advancePerGroup: 2, rematchRule: 'carry' }), 2);
    expect(s).toHaveLength(4);
    const parovi = s.map((x) => [x.homeLabel, x.awayLabel].sort().join('-'));
    expect(parovi).not.toContain('A1-A2');
    expect(parovi).not.toContain('B1-B2');
  });

  it('lucky loser u završnoj skupini', () => {
    const s = finalsSlots(cfg({ format: 'group', advancePerGroup: 1, luckyLosers: 1 }), 3);
    expect(s).toHaveLength(6);
    expect(s.some((x) => x.homeLabel === 'Najbolji drugi' || x.awayLabel === 'Najbolji drugi')).toBe(true);
  });
});

describe('validateFinalsConfig', () => {
  it('kostur s 6 ekipa', () => {
    expect(validateFinalsConfig(cfg({ advancePerGroup: 2 }), [4, 4, 4])).toContainEqual({ key: 'bracket_size', n: 6 });
  });
  it('lucky losera više nego grupa', () => {
    expect(validateFinalsConfig(cfg({ advancePerGroup: 1, luckyLosers: 3 }), [3, 3])).toContainEqual({ key: 'too_many_lucky', max: 2 });
  });
  it('prolazi više nego što grupa ima ekipa', () => {
    expect(validateFinalsConfig(cfg({ format: 'group', advancePerGroup: 3 }), [4, 2])).toContainEqual({
      key: 'group_too_small',
      group: 'B',
      size: 2,
      need: 3,
    });
  });
  it('prazne grupe (prije ždrijeba) nisu greška', () => {
    expect(validateFinalsConfig(defaultFinalsConfig(3), [0, 0, 0])).toEqual([]);
  });
  it('ispravne postavke', () => {
    expect(validateFinalsConfig(cfg({}), [3, 3])).toEqual([]);
  });
});

describe('finalsInSync', () => {
  it('stare utakmice A2–B1 ne odgovaraju B1–A2', () => {
    const ms = matchesFor(cfg({}), 2);
    expect(finalsInSync(finalsSlots(cfg({}), 2), ms)).toBe(true);
    ms[1] = { ...ms[1]!, home_placeholder: 'A2', away_placeholder: 'B1' };
    expect(finalsInSync(finalsSlots(cfg({}), 2), ms)).toBe(false);
  });
  it('isključeno 3. mjesto: višak utakmice', () => {
    expect(finalsInSync(finalsSlots(cfg({ thirdPlace: false }), 2), matchesFor(cfg({}), 2))).toBe(false);
  });
});

describe('planFinals', () => {
  const A = [row('a1', 1, 4), row('a2', 2, 2), row('a3', 3, 0)];
  const B = [row('b1', 1, 4), row('b2', 2, 2), row('b3', 3, 0)];

  it('ništa dok grupe nisu gotove', () => {
    const p = planFinals({ cfg: cfg({}), groups: [A, B], groupMatchesRemaining: 2, matches: matchesFor(cfg({}), 2) });
    expect(p.patches).toEqual([]);
    expect(p.blockers).toContainEqual({ key: 'groups_unfinished', remaining: 2 });
  });

  it('muška polufinala A1–B2 i B1–A2', () => {
    const p = planFinals({ cfg: cfg({}), groups: [A, B], groupMatchesRemaining: 0, matches: matchesFor(cfg({}), 2) });
    expect(p.patches).toContainEqual({ id: 'sf1', home_team_id: 'a1', away_team_id: 'b2' });
    expect(p.patches).toContainEqual({ id: 'sf2', home_team_id: 'b1', away_team_id: 'a2' });
    expect(p.blockers).toContainEqual({ key: 'semifinal_unfinished' });
  });

  it('finale i 3. mjesto iz odigranih polufinala', () => {
    const ms = matchesFor(cfg({}), 2).map((m) =>
      m.id === 'sf1'
        ? { ...m, home_team_id: 'a1', away_team_id: 'b2', home_score: 20, away_score: 18, status: 'finished' as const }
        : m.id === 'sf2'
          ? { ...m, home_team_id: 'b1', away_team_id: 'a2', home_score: 15, away_score: 17, status: 'finished' as const }
          : m
    );
    const p = planFinals({ cfg: cfg({}), groups: [A, B], groupMatchesRemaining: 0, matches: ms });
    expect(p.patches).toContainEqual({ id: 'final', home_team_id: 'a1', away_team_id: 'a2' });
    expect(p.patches).toContainEqual({ id: 'third', home_team_id: 'b2', away_team_id: 'b1' });
  });

  it('ručno postavljenu ekipu ne pregazi, samo javi razliku', () => {
    const ms = matchesFor(cfg({}), 2).map((m) => (m.id === 'sf1' ? { ...m, home_team_id: 'a3' } : m));
    const p = planFinals({ cfg: cfg({}), groups: [A, B], groupMatchesRemaining: 0, matches: ms });
    expect(p.patches).toContainEqual({ id: 'sf1', home_team_id: 'a3', away_team_id: 'b2' });
    expect(p.notes).toContainEqual({ matchId: 'sf1', side: 'home', expectedTeamId: 'a1' });
  });

  it('ženska završna skupina: pobjednice grupa', () => {
    const c = defaultFinalsConfig(3);
    const C = [row('c1', 1, 4), row('c2', 2, 0)];
    const p = planFinals({ cfg: c, groups: [A, B, C], groupMatchesRemaining: 0, matches: matchesFor(c, 3) });
    const timovi = new Set(p.patches.flatMap((x) => [x.home_team_id, x.away_team_id]));
    expect(timovi).toEqual(new Set(['a1', 'b1', 'c1']));
    expect(p.patches).toHaveLength(3);
  });

  it('lucky loser: najbolji drugi po bodovima pa gol-razlici', () => {
    const c = cfg({ advancePerGroup: 1, luckyLosers: 1 });
    const A2 = [row('a1', 1, 4), row('a2', 2, 2, 5)];
    const B2 = [row('b1', 1, 4), row('b2', 2, 2, 1)];
    const C2 = [row('c1', 1, 2), row('c2', 2, 0, 9)];
    const p = planFinals({ cfg: c, groups: [A2, B2, C2], groupMatchesRemaining: 0, matches: matchesFor(c, 3) });
    // Nositelji: a1, b1 (4 boda), c1 (2), pa lucky loser a2.
    const sf1 = p.patches.find((x) => x.id === 'sf1');
    expect(sf1?.away_team_id).toBe('a2');
  });

  it('tri ekipe, najbolji nositelj u finale', () => {
    const c = cfg({ advancePerGroup: 1 });
    const C = [row('c1', 1, 6), row('c2', 2, 0)];
    const p = planFinals({ cfg: c, groups: [A, B, C], groupMatchesRemaining: 0, matches: matchesFor(c, 3) });
    expect(p.patches).toContainEqual({ id: 'final', home_team_id: 'c1', away_team_id: null });
  });

  it('tri ekipe, ždrijeb: traži ždrijeb i ništa ne pogađa', () => {
    const c = cfg({ advancePerGroup: 1, byeRule: 'draw' });
    const C = [row('c1', 1, 6), row('c2', 2, 0)];
    const p = planFinals({ cfg: c, groups: [A, B, C], groupMatchesRemaining: 0, matches: matchesFor(c, 3) });
    expect(p.blockers).toContainEqual({ key: 'draw_needed' });
    expect(p.patches).toEqual([]);
  });

  it('neusklađene utakmice se prijave', () => {
    const p = planFinals({ cfg: cfg({ thirdPlace: false }), groups: [A, B], groupMatchesRemaining: 0, matches: matchesFor(cfg({}), 2) });
    expect(p.blockers).toContainEqual({ key: 'out_of_sync' });
  });
});

describe('drawBye', () => {
  it('jedna u finale, dvije u polufinale, nitko dvaput', () => {
    const r = drawBye(['x', 'y', 'z'], () => 0.5);
    expect(new Set([r.bye, ...r.semi])).toEqual(new Set(['x', 'y', 'z']));
  });
});

describe('finalGroupTable', () => {
  const teams = [
    { id: 'a1', name: 'Alfa', group_id: 'gA' },
    { id: 'a2', name: 'Alfa 2', group_id: 'gA' },
    { id: 'b1', name: 'Beta', group_id: 'gB' },
    { id: 'c1', name: 'Gama', group_id: 'gC' },
  ];
  const points = { pointsWin: 2, pointsDraw: 1, pointsLoss: 0 };
  const fg = (k: string, h: string, a: string, ht: string | null, at: string | null, hs = 0, as = 0, done = false) => ({
    finals_slot: k,
    stage: 'group' as const,
    home_placeholder: h,
    away_placeholder: a,
    home_team_id: ht,
    away_team_id: at,
    home_score: hs,
    away_score: as,
    status: done ? ('finished' as const) : ('scheduled' as const),
  });

  it('nema završne skupine → null', () => {
    expect(finalGroupTable({ matches: [], teams, points, rematchRule: 'replay' })).toBeNull();
  });

  it('prije ždrijeba: tri reda s oznakama, bez ekipa', () => {
    const t = finalGroupTable({
      matches: [
        fg('fg1', 'Pobjednik B', 'Pobjednik C', null, null),
        fg('fg2', 'Pobjednik C', 'Pobjednik A', null, null),
        fg('fg3', 'Pobjednik A', 'Pobjednik B', null, null),
      ],
      teams,
      points,
      rematchRule: 'replay',
    })!;
    expect(t.rows.map((r) => r.teamName)).toEqual(['Pobjednik B', 'Pobjednik C', 'Pobjednik A']);
    expect(t.rows.every((r) => r.teamId === '')).toBe(true);
    expect(t.complete).toBe(false);
  });

  it('odigrano: poredak po bodovima, pobjednik prvi', () => {
    const t = finalGroupTable({
      matches: [
        fg('fg1', 'Pobjednik B', 'Pobjednik C', 'b1', 'c1', 10, 12, true),
        fg('fg2', 'Pobjednik C', 'Pobjednik A', 'c1', 'a1', 14, 9, true),
        fg('fg3', 'Pobjednik A', 'Pobjednik B', 'a1', 'b1', 11, 11, true),
      ],
      teams,
      points,
      rematchRule: 'replay',
    })!;
    expect(t.rows.map((r) => r.teamId)).toEqual(['c1', 'b1', 'a1']);
    expect(t.rows[0]!.points).toBe(4);
    expect(t.complete).toBe(true);
    expect(t.rows[0]!.placeholder).toBe('Pobjednik C');
  });

  it('prenošenje rezultata: grupna utakmica A1–A2 ulazi u tablicu', () => {
    const grupna = {
      finals_slot: null,
      stage: 'group' as const,
      home_placeholder: null,
      away_placeholder: null,
      home_team_id: 'a1',
      away_team_id: 'a2',
      home_score: 20,
      away_score: 10,
      status: 'finished' as const,
    };
    const ms = [grupna, fg('fg1', 'A1', 'B1', 'a1', 'b1'), fg('fg2', 'A2', 'B1', 'a2', 'b1')];
    const carry = finalGroupTable({ matches: ms, teams, points, rematchRule: 'carry' })!;
    expect(carry.rows.find((r) => r.teamId === 'a1')!.points).toBe(2);
    const replay = finalGroupTable({ matches: ms, teams, points, rematchRule: 'replay' })!;
    expect(replay.rows.find((r) => r.teamId === 'a1')!.points).toBe(0);
  });
});
