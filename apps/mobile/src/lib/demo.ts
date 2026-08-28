// demo.ts — bogati demo podaci za korisničku app dok Supabase nije spojen.
// Omogućuje da je app potpuno funkcionalna i vidljiva offline (demo mod).
// Strukture prate tipove iz @zrinjski/core.
import type {
  Day,
  Grp,
  LocationRow,
  Match,
  MatchEvent,
  Contact,
  MvpResult,
  Player,
  ProgramItem,
  Sponsor,
  Team,
  Tournament,
} from '@zrinjski/core';

export const demoTournament: Tournament = {
  id: 'T',
  name: 'VHMRK Zrinjski Cup',
  season_year: 2026,
  match_duration_min: 15,
  gap_min: 5,
  points_win: 2,
  points_draw: 1,
  points_loss: 0,
  advance_per_group: 2,
  reminder_prefs: { day_before_18: true, thirty_min_before: true, schedule_change: true },
  registration_open: true,
  registration_deadline: null,
  mvp_voting_open: false,
  mvp_m_player_id: null,
  mvp_z_player_id: null,
  rules: null,
  format: null,
  about_club: null,
  rules_en: null,
  format_en: null,
  about_club_en: null,
  created_at: '2026-01-01T00:00:00+01:00',
  updated_at: '2026-01-01T00:00:00+01:00',
};

export const demoDays: Day[] = [
  { id: 'D1', tournament_id: 'T', date: '2026-07-10', first_match_time: '18:00:00', sort_order: 0 },
  { id: 'D2', tournament_id: 'T', date: '2026-07-11', first_match_time: '10:00:00', sort_order: 1 },
  { id: 'D3', tournament_id: 'T', date: '2026-07-12', first_match_time: '17:00:00', sort_order: 2 },
];

export const demoGroups: Grp[] = [
  { id: 'GA', tournament_id: 'T', gender: 'm', name: 'Grupa A', sort_order: 0 },
  { id: 'GB', tournament_id: 'T', gender: 'm', name: 'Grupa B', sort_order: 1 },
  { id: 'GZ', tournament_id: 'T', gender: 'z', name: 'Grupa A', sort_order: 0 },
];

// `color` se više ne koristi u UI-ju (boja grba = crestColorFor(sort_order)),
// ostaje samo da demo redovi zadovolje tip baze.
let demoMIdx = 0;
let demoZIdx = 0;
function team(
  id: string,
  name: string,
  short: string,
  color: string,
  gender: 'm' | 'z',
  group: string | null,
  coach: string
): Team {
  return {
    id,
    tournament_id: 'T',
    name,
    short_code: short,
    color,
    gender,
    group_id: group,
    coach_name: coach,
    rep_email: null,
    logo_url: null,
    sort_order: gender === 'm' ? demoMIdx++ : demoZIdx++,
    created_at: '2026-01-01T00:00:00+01:00',
  };
}

export const demoTeams: Team[] = [
  team('zri', 'VHMRK Zrinjski', 'ZRI', '#E11D2A', 'm', 'GA', 'Ivan Ivić'),
  team('gru', 'Grude Legende', 'GRU', '#6A1FB0', 'm', 'GA', 'Marko Barić'),
  team('cap', 'Čapljina', 'CAP', '#1F7A8C', 'm', 'GA', 'Stipe Soldo'),
  team('izv', 'Izviđač', 'IZV', '#2D6CDF', 'm', 'GB', 'Tomo Mršić'),
  team('pos', 'Posušje veterani', 'POS', '#C2410C', 'm', 'GB', 'Ante Lučić'),
  team('sir', 'Široki', 'SIR', '#0D9488', 'm', 'GB', 'Josip Bago'),
  team('las', 'ŽRK Lasta', 'LAS', '#B03060', 'z', 'GZ', 'Maja Kovač'),
  team('zrz', 'Zrinjski Ž', 'ZRŽ', '#E11D2A', 'z', 'GZ', 'Ana Pavić'),
  team('grz', 'Grude Ž', 'GRŽ', '#6A1FB0', 'z', 'GZ', 'Iva Barić'),
];

function players(teamId: string, names: [number, string, boolean?][]): Player[] {
  return names.map(([number, name, cap], i) => ({
    id: `${teamId}-p${i}`,
    team_id: teamId,
    number,
    name,
    is_captain: !!cap,
    sort_order: i,
  }));
}

export const demoPlayers: Player[] = [
  ...players('zri', [
    [1, 'Marko Jurić', true],
    [4, 'Luka Bevanda'],
    [7, 'Ivan Soldo'],
    [9, 'Josip Marić'],
    [11, 'Petar Kožul'],
    [12, 'Ante Vasilj'],
  ]),
  ...players('gru', [
    [1, 'Ante Babić', true],
    [5, 'Mirko Pavić'],
    [8, 'Tomo Vidović'],
    [10, 'Ivan Lučić'],
    [14, 'Marko Soldo'],
  ]),
  ...players('cap', [
    [2, 'Stipe Raguž', true],
    [6, 'Dario Bošnjak'],
    [9, 'Mate Zovko'],
  ]),
  ...players('izv', [
    [3, 'Goran Mršić', true],
    [7, 'Damir Kvesić'],
    [10, 'Robert Šarić'],
  ]),
  ...players('pos', [
    [1, 'Zoran Begić', true],
    [8, 'Filip Galić'],
    [11, 'Nikola Erceg'],
  ]),
  ...players('sir', [
    [4, 'Ivan Naletilić', true],
    [9, 'Tin Krišto'],
  ]),
  ...players('las', [
    [1, 'Petra Kovač', true],
    [7, 'Iva Soldo'],
    [9, 'Maja Lučić'],
  ]),
  ...players('zrz', [
    [3, 'Ana Marić', true],
    [8, 'Lucija Bago'],
  ]),
  ...players('grz', [
    [5, 'Dora Pavić', true],
    [10, 'Klara Vidović'],
  ]),
];

function m(
  id: string,
  gender: 'm' | 'z',
  stage: Match['stage'],
  grp: string | null,
  day: string | null,
  home: string | null,
  away: string | null,
  hs: number,
  as: number,
  status: Match['status'],
  time: string | null,
  sort: number,
  extra?: Partial<Match>
): Match {
  return {
    id,
    tournament_id: 'T',
    day_id: day,
    gender,
    stage,
    grp_id: grp,
    home_team_id: home,
    away_team_id: away,
    home_placeholder: extra?.home_placeholder ?? null,
    away_placeholder: extra?.away_placeholder ?? null,
    home_score: hs,
    away_score: as,
    scheduled_time: time,
    status,
    sort_order: sort,
    best_player_id: extra?.best_player_id ?? null,
    current_minute: extra?.current_minute ?? null,
    current_half: extra?.current_half ?? null,
  };
}

export const demoMatches: Match[] = [
  // Grupa A (M) — odigrano
  m('m1', 'm', 'group', 'GA', 'D1', 'zri', 'cap', 31, 25, 'finished', '2026-07-10T18:00:00+02:00', 0),
  m('m2', 'm', 'group', 'GA', 'D1', 'gru', 'cap', 27, 27, 'finished', '2026-07-10T18:20:00+02:00', 1),
  // Grupa B (M) — odigrano
  m('m3', 'm', 'group', 'GB', 'D1', 'izv', 'sir', 23, 25, 'finished', '2026-07-10T18:40:00+02:00', 2),
  m('m4', 'm', 'group', 'GB', 'D1', 'pos', 'sir', 19, 30, 'finished', '2026-07-10T19:00:00+02:00', 3),
  // UŽIVO sada (Grupa A): Zrinjski vs Grude
  m('m5', 'm', 'group', 'GA', 'D2', 'zri', 'gru', 4, 2, 'live', '2026-07-11T10:00:00+02:00', 4, {
    current_minute: 12,
    current_half: 1,
  }),
  // Najavljeno (Grupa B)
  m('m6', 'm', 'group', 'GB', 'D2', 'izv', 'pos', 0, 0, 'scheduled', '2026-07-11T10:20:00+02:00', 5),
  // Ž grupa
  m('m7', 'z', 'group', 'GZ', 'D2', 'las', 'zrz', 22, 18, 'finished', '2026-07-11T10:40:00+02:00', 6),
  m('m8', 'z', 'group', 'GZ', 'D2', 'zrz', 'grz', 0, 0, 'scheduled', '2026-07-11T11:00:00+02:00', 7),
  // Završnica (M)
  m('sf1', 'm', 'semifinal', null, 'D3', null, null, 0, 0, 'scheduled', '2026-07-12T17:00:00+02:00', 8, {
    home_placeholder: 'A1',
    away_placeholder: 'B2',
  }),
  m('sf2', 'm', 'semifinal', null, 'D3', null, null, 0, 0, 'scheduled', '2026-07-12T17:20:00+02:00', 9, {
    home_placeholder: 'A2',
    away_placeholder: 'B1',
  }),
  m('tp', 'm', 'third_place', null, 'D3', null, null, 0, 0, 'scheduled', '2026-07-12T17:40:00+02:00', 10, {
    home_placeholder: 'Poraženi PF1',
    away_placeholder: 'Poraženi PF2',
  }),
  m('fin', 'm', 'final', null, 'D3', null, null, 0, 0, 'scheduled', '2026-07-12T18:00:00+02:00', 11, {
    home_placeholder: 'Pobjednik PF1',
    away_placeholder: 'Pobjednik PF2',
  }),
];

function ev(id: string, match: string, team: string, player: string, type: MatchEvent['type'], minute: number): MatchEvent {
  return {
    id,
    match_id: match,
    team_id: team,
    player_id: player,
    type,
    minute,
    created_at: `2026-07-11T10:${String(minute).padStart(2, '0')}:00+02:00`,
  };
}

// Tijek za UŽIVO utakmicu m5 (ZRI 4:2 GRU) + ponešto za statistiku.
const baseEvents: MatchEvent[] = [
  ev('e1', 'm5', 'zri', 'zri-p0', 'goal', 2),
  ev('e2', 'm5', 'gru', 'gru-p0', 'save', 3),
  ev('e3', 'm5', 'zri', 'zri-p2', 'goal', 5),
  ev('e4', 'm5', 'gru', 'gru-p2', 'goal', 7),
  ev('e5', 'm5', 'zri', 'zri-p0', 'goal', 9),
  ev('e6', 'm5', 'gru', 'gru-p3', 'goal', 10),
  ev('e7', 'm5', 'zri', 'zri-p3', 'goal', 12),
  ev('e8', 'm5', 'gru', 'gru-p1', 'suspension_2min', 12),
  // Iz odigranih (za strijelce/vratare)
  ev('e9', 'm1', 'zri', 'zri-p0', 'goal', 4),
  ev('e10', 'm1', 'zri', 'zri-p2', 'goal', 8),
  ev('e11', 'm1', 'cap', 'cap-p0', 'save', 6),
  ev('e12', 'm3', 'sir', 'sir-p1', 'goal', 5),
  ev('e13', 'm7', 'las', 'las-p1', 'goal', 7),
];

/**
 * Dopuni golove odigranih utakmica do upisanog rezultata.
 *
 * U pravoj bazi rezultat podiže okidač iz `match_event`, pa se to dvoje ne
 * može razići. U demou su rezultati bili upisani ručno, a događaja je bilo
 * tek nekoliko — pa je ekran pokazivao "22:18" uz jednog strijelca. Ovime se
 * razlika popunjava, a ne prepisuje: već upisani golovi ostaju.
 */
function fillGoals(base: MatchEvent[]): MatchEvent[] {
  const out: MatchEvent[] = [];
  let n = 0;
  for (const m of demoMatches) {
    if (m.status !== 'finished' || !m.home_team_id || !m.away_team_id) continue;
    for (const [teamId, target] of [
      [m.home_team_id, m.home_score],
      [m.away_team_id, m.away_score],
    ] as const) {
      const already = base.filter(
        (e) => e.match_id === m.id && e.team_id === teamId && e.type === 'goal'
      ).length;
      const roster = demoPlayers.filter((p) => p.team_id === teamId);
      if (roster.length === 0) continue;
      for (let i = already; i < target; i += 1) {
        n += 1;
        // Strijelci se izmjenjuju po sastavu da statistika ne padne na jednog.
        const p = roster[i % roster.length]!;
        out.push(ev(`f${n}`, m.id, teamId, p.id, 'goal', 1 + ((i * 3) % 29)));
      }
    }
  }
  return out;
}

export const demoEvents: MatchEvent[] = [...baseEvents, ...fillGoals(baseEvents)];

export const demoSponsors: Sponsor[] = [
  { id: 's1', tournament_id: 'T', name: 'Elektroprivreda HZHB', tier: 'gold', logo_url: null, is_active: true, sort_order: 0 },
  { id: 's2', tournament_id: 'T', name: 'Euroherc', tier: 'silver', logo_url: null, is_active: true, sort_order: 1 },
  { id: 's3', tournament_id: 'T', name: 'HT Eronet', tier: 'silver', logo_url: null, is_active: true, sort_order: 2 },
  { id: 's4', tournament_id: 'T', name: 'JYSK', tier: 'bronze', logo_url: null, is_active: true, sort_order: 3 },
  { id: 's5', tournament_id: 'T', name: 'Konzum', tier: 'partner', logo_url: null, is_active: true, sort_order: 4 },
];

export const demoLocations: LocationRow[] = [
  { id: 'l1', tournament_id: 'T', type: 'hall', name: 'Dvorana Bijeli Brijeg', description: 'Glavna dvorana', lat: 43.3389, lng: 17.7964, sort_order: 0 },
  { id: 'l2', tournament_id: 'T', type: 'tent', name: 'Šator (parking)', description: 'Druženje ispred dvorane', lat: 43.339, lng: 17.797, sort_order: 1 },
  { id: 'l3', tournament_id: 'T', type: 'dinner', name: 'Restoran Mepas', description: 'Završna večera', lat: 43.3438, lng: 17.8081, sort_order: 2 },
  { id: 'l4', tournament_id: 'T', type: 'hotel', name: 'Hotel Mostar', description: null, lat: 43.3471, lng: 17.8089, sort_order: 3 },
  { id: 'l5', tournament_id: 'T', type: 'hotel', name: 'Hotel Bristol', description: null, lat: 43.3402, lng: 17.8133, sort_order: 4 },
];

export const demoProgram: ProgramItem[] = [
  { id: 'pr1', tournament_id: 'T', day_id: 'D1', time: '21:00:00', title: 'Svečano otvorenje + druženje', location_id: 'l2', sort_order: 0 },
  { id: 'pr2', tournament_id: 'T', day_id: 'D2', time: '21:30:00', title: 'Večera u šatoru', location_id: 'l2', sort_order: 0 },
  { id: 'pr3', tournament_id: 'T', day_id: 'D3', time: '20:30:00', title: 'Dodjela pehara + završna večera', location_id: 'l3', sort_order: 0 },
];

// Galerija: boje umjesto stvarnih slika (offline demo nema mrežu ni Storage).
/**
 * Rezultat glasanja u DEMO načinu — glasanje je zatvoreno pa se nagrada vidi.
 * Uživo ovo dolazi iz RPC-a mvp_results(), koji vraća prazno dok je otvoreno.
 */
export const demoMvpResults: MvpResult[] = [
  { player_id: 'gru-p2', gender: 'm', votes: 3 },
  { player_id: 'zri-p3', gender: 'm', votes: 2 },
  { player_id: 'izv-p0', gender: 'm', votes: 1 },
  { player_id: 'las-p1', gender: 'z', votes: 2 },
  { player_id: 'zrz-p0', gender: 'z', votes: 1 },
];

/** Kontakti organizatora — u DEMO načinu izmišljeni. */
export const demoContacts: Contact[] = [
  { id: 'c1', tournament_id: 'T', name: 'Ivan Ivić', role: 'Direktor turnira', phone: '+387 63 111 222', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
  { id: 'c2', tournament_id: 'T', name: 'Marko Marić', role: 'Delegat', phone: '+387 63 333 444', sort_order: 1, created_at: '2026-01-01T00:00:00Z' },
  { id: 'c3', tournament_id: 'T', name: 'Ana Anić', role: 'Prijave ekipa', phone: '+387 63 555 666', sort_order: 2, created_at: '2026-01-01T00:00:00Z' },
];

export const demoGallery: { id: string; day_id: string; color: string; url: string | null }[] = [
  { id: 'g1', day_id: 'D1', color: '#E11D2A', url: null },
  { id: 'g2', day_id: 'D1', color: '#2D6CDF', url: null },
  { id: 'g3', day_id: 'D1', color: '#6A1FB0', url: null },
  { id: 'g4', day_id: 'D2', color: '#1F7A8C', url: null },
  { id: 'g5', day_id: 'D2', color: '#C2410C', url: null },
  { id: 'g6', day_id: 'D2', color: '#0D9488', url: null },
];
