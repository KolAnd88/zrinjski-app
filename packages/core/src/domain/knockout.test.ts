import { describe, expect, it } from 'vitest';
import {
  knockoutView,
  missingKnockoutMatches,
  planKnockout,
  semifinalOutcome,
  type KnockoutMatch,
} from './knockout';
import type { StandingRow } from './standings';

const row = (teamId: string, rank: number): StandingRow => ({
  teamId,
  teamName: teamId.toUpperCase(),
  rank,
  played: 3,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
  points: 0,
  qualifies: rank <= 2,
});

const A = [row('a1', 1), row('a2', 2), row('a3', 3)];
const B = [row('b1', 1), row('b2', 2), row('b3', 3)];

type TestRow = KnockoutMatch & { home_placeholder?: string | null; away_placeholder?: string | null };

const m = (p: Partial<TestRow> & Pick<TestRow, 'id' | 'stage'>): TestRow => ({
  gender: 'm',
  sort_order: 0,
  home_team_id: null,
  away_team_id: null,
  home_score: 0,
  away_score: 0,
  status: 'scheduled',
  ...p,
});

/** Grupna faza: sve odigrano, osim ako se kaže drukčije. */
const groupMatches = (unfinished = 0): KnockoutMatch[] =>
  [0, 1, 2, 3].map((i) =>
    m({
      id: `g${i}`,
      stage: 'group',
      sort_order: i,
      status: i < unfinished ? 'scheduled' : 'finished',
    })
  );

const semis = () => [
  m({ id: 'pf1', stage: 'semifinal', sort_order: 10 }),
  m({ id: 'pf2', stage: 'semifinal', sort_order: 11 }),
];
const endGames = () => [
  m({ id: 'third', stage: 'third_place', sort_order: 12 }),
  m({ id: 'fin', stage: 'final', sort_order: 13 }),
];

const plan = (matches: KnockoutMatch[]) =>
  planKnockout({ gender: 'm', matches, groupA: A, groupB: B });

describe('semifinalOutcome', () => {
  it('pobjednik i poraženi iz odigrane utakmice', () => {
    const r = semifinalOutcome(
      m({ id: 'x', stage: 'semifinal', status: 'finished', home_team_id: 'a1', away_team_id: 'b2', home_score: 3, away_score: 1 })
    );
    expect(r).toEqual({ winnerTeamId: 'a1', loserTeamId: 'b2' });
  });

  it('gost pobjednik', () => {
    const r = semifinalOutcome(
      m({ id: 'x', stage: 'semifinal', status: 'finished', home_team_id: 'a1', away_team_id: 'b2', home_score: 1, away_score: 3 })
    );
    expect(r).toEqual({ winnerTeamId: 'b2', loserTeamId: 'a1' });
  });

  it('neodigrana utakmica nema ishod', () => {
    expect(semifinalOutcome(m({ id: 'x', stage: 'semifinal', home_team_id: 'a1', away_team_id: 'b2' }))).toBeNull();
  });

  // Aplikacija ne poznaje jedanaesterce; neriješeno se mora prijaviti, ne pogoditi.
  it('neriješeno nema ishod', () => {
    expect(
      semifinalOutcome(
        m({ id: 'x', stage: 'semifinal', status: 'finished', home_team_id: 'a1', away_team_id: 'b2', home_score: 2, away_score: 2 })
      )
    ).toBeNull();
  });
});

describe('planKnockout — polufinala', () => {
  it('postavlja A1–B2 i A2–B1 kad je grupna faza gotova', () => {
    const { patches } = plan([...groupMatches(), ...semis(), ...endGames()]);
    expect(patches).toContainEqual({ id: 'pf1', home_team_id: 'a1', away_team_id: 'b2' });
    expect(patches).toContainEqual({ id: 'pf2', home_team_id: 'a2', away_team_id: 'b1' });
  });

  // Do kraja grupa je ljestvica privremena — postaviti ekipe znacilo bi
  // upisati krive.
  it('ne postavlja dok grupne utakmice nisu odigrane', () => {
    const { patches, blockers } = plan([...groupMatches(2), ...semis(), ...endGames()]);
    expect(patches.filter((p) => p.id.startsWith('pf'))).toHaveLength(0);
    expect(blockers).toContainEqual({ key: 'groups_unfinished', remaining: 2 });
  });

  it('javlja kad polufinala uopće ne postoje', () => {
    const { blockers } = plan([...groupMatches(), ...endGames()]);
    expect(blockers).toContainEqual({ key: 'no_semifinals' });
  });

  it('grupa s manje od dvije ekipe ne može dati prolaznike', () => {
    const { blockers } = planKnockout({
      gender: 'm',
      matches: [...groupMatches(), ...semis(), ...endGames()],
      groupA: [row('a1', 1)],
      groupB: B,
    });
    expect(blockers).toContainEqual({ key: 'not_enough_teams', group: 'A' });
  });

  it('ništa se ne mijenja ako su ekipe već ispravno postavljene', () => {
    const s = semis();
    s[0]!.home_team_id = 'a1';
    s[0]!.away_team_id = 'b2';
    s[1]!.home_team_id = 'a2';
    s[1]!.away_team_id = 'b1';
    const { patches } = plan([...groupMatches(), ...s, ...endGames()]);
    expect(patches.filter((p) => p.id.startsWith('pf'))).toHaveLength(0);
  });
});

describe('planKnockout — finale i 3. mjesto', () => {
  const playedSemis = (s1: [number, number] = [3, 1], s2: [number, number] = [2, 4]) => {
    const s = semis();
    Object.assign(s[0]!, { status: 'finished', home_team_id: 'a1', away_team_id: 'b2', home_score: s1[0], away_score: s1[1] });
    Object.assign(s[1]!, { status: 'finished', home_team_id: 'a2', away_team_id: 'b1', home_score: s2[0], away_score: s2[1] });
    return s;
  };

  it('pobjednici idu u finale, poraženi za 3. mjesto', () => {
    const { patches } = plan([...groupMatches(), ...playedSemis(), ...endGames()]);
    expect(patches).toContainEqual({ id: 'fin', home_team_id: 'a1', away_team_id: 'b1' });
    expect(patches).toContainEqual({ id: 'third', home_team_id: 'b2', away_team_id: 'a2' });
  });

  it('dok polufinala nisu odigrana, finale ostaje prazno', () => {
    const { patches, blockers } = plan([...groupMatches(), ...semis(), ...endGames()]);
    expect(patches.find((p) => p.id === 'fin')).toBeUndefined();
    expect(blockers).toContainEqual({ key: 'semifinal_unfinished' });
  });

  it('neriješeno polufinale se prijavljuje, ne pogađa', () => {
    const { patches, blockers } = plan([...groupMatches(), ...playedSemis([2, 2]), ...endGames()]);
    expect(patches.find((p) => p.id === 'fin')).toBeUndefined();
    expect(blockers).toContainEqual({ key: 'semifinal_drawn', matchId: 'pf1' });
  });
});

describe('planKnockout — zaštita odigranog', () => {
  // Prepisivanje ekipa na utakmici koja traje ostavilo bi golove na krivima.
  it('utakmica koja traje se ne dira', () => {
    const s = semis();
    s[0]!.status = 'live';
    const { patches, blockers } = plan([...groupMatches(), ...s, ...endGames()]);
    expect(patches.find((p) => p.id === 'pf1')).toBeUndefined();
    expect(blockers).toContainEqual({ key: 'already_started', matchId: 'pf1' });
  });

  it('odigrana utakmica se ne dira', () => {
    const s = semis();
    Object.assign(s[0]!, { status: 'finished', home_team_id: 'x', away_team_id: 'y', home_score: 1, away_score: 0 });
    const { patches } = plan([...groupMatches(), ...s, ...endGames()]);
    expect(patches.find((p) => p.id === 'pf1')).toBeUndefined();
  });

  it('druga konkurencija se ne dira', () => {
    const zenske = semis().map((x) => ({ ...x, id: `z-${x.id}`, gender: 'z' as const }));
    const { patches } = plan([...groupMatches(), ...semis(), ...endGames(), ...zenske]);
    expect(patches.every((p) => !p.id.startsWith('z-'))).toBe(true);
  });
});

describe('missingKnockoutMatches — novi turnir', () => {
  it('prazan turnir treba sve četiri utakmice završnice', () => {
    const out = missingKnockoutMatches([], 'm');
    expect(out.map((x) => x.stage)).toEqual(['semifinal', 'semifinal', 'third_place', 'final']);
    expect(out[0]).toMatchObject({ home_placeholder: 'A1', away_placeholder: 'B2' });
    expect(out[1]).toMatchObject({ home_placeholder: 'A2', away_placeholder: 'B1' });
  });

  it('ne duplicira ono što već postoji', () => {
    const have = [...semis(), ...endGames()];
    expect(missingKnockoutMatches(have, 'm')).toEqual([]);
  });

  // Pola napravljene završnice je stvarno stanje ako je netko rucno brisao.
  it('dodaje samo ono što fali', () => {
    const out = missingKnockoutMatches([m({ id: 'pf1', stage: 'semifinal' })], 'm');
    expect(out.map((x) => x.stage)).toEqual(['semifinal', 'third_place', 'final']);
    // Preostalo polufinale je DRUGO — oznake moraju ostati A2/B1.
    expect(out[0]).toMatchObject({ home_placeholder: 'A2', away_placeholder: 'B1' });
  });

  it('gleda samo svoju konkurenciju', () => {
    const zenske = [...semis(), ...endGames()].map((x) => ({ ...x, gender: 'z' as const }));
    expect(missingKnockoutMatches(zenske, 'm')).toHaveLength(4);
  });
});

describe('knockoutView — završnica iz baze', () => {
  const rows = [
    m({ id: 'g1', stage: 'group', sort_order: 0 }),
    m({ id: 'fin', stage: 'final', sort_order: 13, home_placeholder: 'Pobjednik PF1' }),
    m({ id: 'pf1', stage: 'semifinal', sort_order: 10, home_team_id: 'a1', away_team_id: 'b2', status: 'finished', home_score: 3, away_score: 1 }),
    m({ id: 'third', stage: 'third_place', sort_order: 12 }),
    m({ id: 'pf2', stage: 'semifinal', sort_order: 11 }),
  ] as (KnockoutMatch & { home_placeholder?: string | null })[];

  it('izbacuje grupne i slaže redom kojim se igra', () => {
    expect(knockoutView(rows, 'm').map((x) => x.id)).toEqual(['pf1', 'pf2', 'third', 'fin']);
  });

  it('nosi stvarne ekipe, rezultat i status iz baze', () => {
    const pf1 = knockoutView(rows, 'm')[0]!;
    expect(pf1).toMatchObject({
      homeTeamId: 'a1',
      awayTeamId: 'b2',
      homeScore: 3,
      awayScore: 1,
      status: 'finished',
    });
  });

  it('bez ekipe ostaje oznaka', () => {
    const fin = knockoutView(rows, 'm').find((x) => x.id === 'fin')!;
    expect(fin.homeTeamId).toBeNull();
    expect(fin.homePlaceholder).toBe('Pobjednik PF1');
  });
});
