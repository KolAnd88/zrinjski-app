// demoDb.ts — lokalni demo podaci (u memoriji) za web admin DEMO mod.
// Mutabilni singleton: data.ts u DEMO grani čita/piše ovdje. Ukloni se kad
// se spoji Supabase (DEMO = false). Predstavlja jedan turnir s muškom i ženskom
// konkurencijom, grupama, ekipama, igračima, satnicom, sponzorima, prijavama…
import type {
  Contact,
  Day,
  GalleryPhoto,
  Grp,
  LocationRow,
  Match,
  MatchEvent,
  NotificationLog,
  Player,
  ProgramItem,
  Registration,
  Sponsor,
  Team,
  Tournament,
  MvpVote,
} from '@zrinjski/core';

let seq = 0;
export function genId(prefix = 'id'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

const T = 't1';
const D2 = 'd2';
const D3 = 'd3';

const tournament: Tournament = {
  id: T,
  name: 'Ponos Hercegovine 2026',
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
  mvp_voting_open: true,
  mvp_m_player_id: null,
  mvp_z_player_id: null,
  rules: null,
  format: null,
  about_club: null,
  rules_en: null,
  format_en: null,
  about_club_en: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const days: Day[] = [
  { id: 'd1', tournament_id: T, date: '2026-06-05', first_match_time: null, sort_order: 0 },
  { id: D2, tournament_id: T, date: '2026-06-06', first_match_time: '10:00:00', sort_order: 1 },
  { id: D3, tournament_id: T, date: '2026-06-07', first_match_time: '10:00:00', sort_order: 2 },
];

// Grupe
const gMA = 'gma';
const gMB = 'gmb';
const gZA = 'gza';
const groups: Grp[] = [
  { id: gMA, tournament_id: T, gender: 'm', name: 'Grupa A', sort_order: 0 },
  { id: gMB, tournament_id: T, gender: 'm', name: 'Grupa B', sort_order: 1 },
  { id: gZA, tournament_id: T, gender: 'z', name: 'Grupa A', sort_order: 0 },
];

// Ekipe. `color` se više ne koristi u UI-ju (boja = crestColorFor(sort_order)),
// ostaje samo da demo redovi zadovolje tip. sort_order se dodjeljuje redom po spolu.
let mIdx = 0;
let zIdx = 0;
function team(id: string, name: string, code: string, color: string, gender: 'm' | 'z', group: string | null, coach: string): Team {
  return {
    id, tournament_id: T, name, short_code: code, color, gender, group_id: group,
    coach_name: coach, logo_url: null,
    sort_order: gender === 'm' ? mIdx++ : zIdx++,
    created_at: '2026-01-01T00:00:00Z',
  };
}
const teams: Team[] = [
  team('zri', 'VHMRK Zrinjski', 'ZRI', '#E11D2A', 'm', gMA, 'Ivan Ivić'),
  team('gru', 'Grude Legende', 'GRU', '#6A1FB0', 'm', gMA, 'Marko Marić'),
  team('izv', 'Izviđač', 'IZV', '#1F7A8C', 'm', gMA, 'Pero Perić'),
  team('pos', 'Posušje veterani', 'POS', '#C2410C', 'm', gMA, 'Ante Antić'),
  team('cap', 'Čapljina', 'CAP', '#0D9488', 'm', gMB, 'Josip Josić'),
  team('bos', 'Bosna', 'BOS', '#2D6CDF', 'm', gMB, 'Luka Lukić'),
  team('zen', 'Zenica', 'ZEN', '#B03060', 'm', gMB, 'Mate Matić'),
  team('sir', 'Široki', 'SIR', '#0E7490', 'm', gMB, 'Stipe Stipić'),
  team('las', 'ŽRK Lasta', 'LAS', '#B03060', 'z', gZA, 'Maja Kovač'),
  team('nmo', 'Mostar Ž', 'MOS', '#E11D2A', 'z', gZA, 'Ana Anić'),
  team('neu', 'Neum Ž', 'NEU', '#1F7A8C', 'z', gZA, 'Iva Ivić'),
];

// Igrači (puni sastav za ZRI i GRU radi unosa uživo; ostali kraće)
function roster(teamId: string, names: string[], captainIdx = 0): Player[] {
  return names.map((name, i) => ({
    id: genId('p'),
    team_id: teamId,
    number: i + 1,
    name,
    is_captain: i === captainIdx,
    sort_order: i,
  }));
}
const players: Player[] = [
  ...roster('zri', ['Marko Jurić', 'Ivan Babić', 'Josip Marić', 'Luka Bevanda', 'Petar Soldo', 'Ante Kovač', 'Tomo Lulić']),
  ...roster('gru', ['Ante Babić', 'Mirko Pavić', 'Tomo Vidović', 'Ivan Lučić', 'Marko Soldo', 'Petar Galić', 'Ivan Soldo']),
  ...roster('izv', ['Goran Mršić', 'Damir Bago', 'Tihomir Zovko']),
  ...roster('pos', ['Slaven Boban', 'Mate Jelić']),
  ...roster('cap', ['Dario Krešić', 'Boris Šarić', 'Ivan Zovko']),
  ...roster('bos', ['Emir Hadžić', 'Adnan Selimović', 'Damir Kovač']),
  ...roster('zen', ['Haris Delić', 'Muamer Begić', 'Senad Alić']),
  ...roster('sir', ['Ivan Naletilić', 'Tin Krišto', 'Mario Šarić']),
  ...roster('neu', ['Lucija Vukoja', 'Marija Raič']),
  ...roster('las', ['Maja Kovač', 'Iva Bošnjak', 'Petra Lulić']),
  ...roster('nmo', ['Ana Anić', 'Sara Marić']),
];

// Utakmice
function match(p: Partial<Match> & Pick<Match, 'id' | 'gender' | 'stage'>): Match {
  return {
    tournament_id: T,
    day_id: D2,
    grp_id: null,
    home_team_id: null,
    away_team_id: null,
    home_placeholder: null,
    away_placeholder: null,
    home_score: 0,
    away_score: 0,
    scheduled_time: null,
    status: 'scheduled',
    sort_order: 0,
    best_player_id: null,
    current_minute: null,
    current_half: null,
    ...p,
  };
}
const matches: Match[] = [
  // Muški — Grupa A (round-robin, dio odigran/uživo)
  match({ id: 'm1', gender: 'm', stage: 'group', grp_id: gMA, home_team_id: 'zri', away_team_id: 'pos', home_score: 5, away_score: 2, status: 'finished', scheduled_time: '2026-06-06T10:00:00+02:00', sort_order: 0 }),
  match({ id: 'm2', gender: 'm', stage: 'group', grp_id: gMA, home_team_id: 'izv', away_team_id: 'gru', home_score: 3, away_score: 3, status: 'finished', scheduled_time: '2026-06-06T10:20:00+02:00', sort_order: 1 }),
  match({ id: 'm3', gender: 'm', stage: 'group', grp_id: gMA, home_team_id: 'zri', away_team_id: 'gru', home_score: 4, away_score: 2, status: 'live', scheduled_time: '2026-06-06T10:40:00+02:00', sort_order: 2, current_minute: 12, current_half: 1 }),
  match({ id: 'm4', gender: 'm', stage: 'group', grp_id: gMA, home_team_id: 'izv', away_team_id: 'pos', scheduled_time: '2026-06-06T11:00:00+02:00', sort_order: 3 }),
  match({ id: 'm5', gender: 'm', stage: 'group', grp_id: gMA, home_team_id: 'zri', away_team_id: 'izv', scheduled_time: '2026-06-06T11:20:00+02:00', sort_order: 4 }),
  match({ id: 'm6', gender: 'm', stage: 'group', grp_id: gMA, home_team_id: 'gru', away_team_id: 'pos', scheduled_time: '2026-06-06T11:40:00+02:00', sort_order: 5 }),
  // Muški — Grupa B
  match({ id: 'm7', gender: 'm', stage: 'group', grp_id: gMB, home_team_id: 'cap', away_team_id: 'bos', scheduled_time: '2026-06-06T12:00:00+02:00', sort_order: 6 }),
  match({ id: 'm8', gender: 'm', stage: 'group', grp_id: gMB, home_team_id: 'zen', away_team_id: 'sir', scheduled_time: '2026-06-06T12:20:00+02:00', sort_order: 7 }),
  // Završnica (placeholderi)
  match({ id: 'sf1', gender: 'm', stage: 'semifinal', home_placeholder: 'A1', away_placeholder: 'B2', day_id: D3, scheduled_time: '2026-06-07T17:00:00+02:00', sort_order: 20 }),
  match({ id: 'sf2', gender: 'm', stage: 'semifinal', home_placeholder: 'A2', away_placeholder: 'B1', day_id: D3, scheduled_time: '2026-06-07T17:30:00+02:00', sort_order: 21 }),
  match({ id: 'third', gender: 'm', stage: 'third_place', home_placeholder: 'Poraženi PF1', away_placeholder: 'Poraženi PF2', day_id: D3, scheduled_time: '2026-06-07T18:00:00+02:00', sort_order: 22 }),
  match({ id: 'fin', gender: 'm', stage: 'final', home_placeholder: 'Pobjednik PF1', away_placeholder: 'Pobjednik PF2', day_id: D3, scheduled_time: '2026-06-07T19:00:00+02:00', sort_order: 23 }),
  // Žene — Grupa A
  match({ id: 'w1', gender: 'z', stage: 'group', grp_id: gZA, home_team_id: 'las', away_team_id: 'nmo', home_score: 1, away_score: 0, status: 'finished', scheduled_time: '2026-06-06T13:00:00+02:00', sort_order: 8 }),
  match({ id: 'w2', gender: 'z', stage: 'group', grp_id: gZA, home_team_id: 'nmo', away_team_id: 'neu', scheduled_time: '2026-06-06T13:20:00+02:00', sort_order: 9 }),
];

// Događaji (za odigrane + live → pune statistiku i tijek)
function ev(matchId: string, teamId: string, playerId: string | null, type: MatchEvent['type'], minute: number): MatchEvent {
  return { id: genId('e'), match_id: matchId, team_id: teamId, player_id: playerId, type, minute, created_at: new Date(2026, 5, 6, 10, minute).toISOString() };
}
const pZri = players.filter((p) => p.team_id === 'zri');
const pGru = players.filter((p) => p.team_id === 'gru');
const pIzv = players.filter((p) => p.team_id === 'izv');
const pPos = players.filter((p) => p.team_id === 'pos');
const pLas = players.filter((p) => p.team_id === 'las');
const events: MatchEvent[] = [
  // m3 live ZRI 4:2 GRU
  ev('m3', 'zri', pZri[0]!.id, 'goal', 2),
  ev('m3', 'gru', pGru[0]!.id, 'save', 3),
  ev('m3', 'zri', pZri[2]!.id, 'goal', 5),
  ev('m3', 'gru', pGru[2]!.id, 'goal', 7),
  ev('m3', 'zri', pZri[3]!.id, 'suspension_2min', 9),
  ev('m3', 'gru', pGru[3]!.id, 'goal', 10),
  ev('m3', 'zri', pZri[0]!.id, 'goal', 12),
  ev('m3', 'zri', pZri[4]!.id, 'goal', 14),
  // m1 finished ZRI 5:2 POS
  ev('m1', 'zri', pZri[0]!.id, 'goal', 4),
  ev('m1', 'zri', pZri[1]!.id, 'goal', 8),
  ev('m1', 'zri', pZri[0]!.id, 'goal', 11),
  ev('m1', 'zri', pZri[2]!.id, 'goal', 14),
  ev('m1', 'zri', pZri[3]!.id, 'goal', 19),
  ev('m1', 'pos', pPos[0]!.id, 'goal', 6),
  ev('m1', 'pos', pPos[1]!.id, 'goal', 17),
  // m2 finished IZV 3:3 GRU
  ev('m2', 'izv', pIzv[0]!.id, 'goal', 3),
  ev('m2', 'izv', pIzv[1]!.id, 'goal', 9),
  ev('m2', 'izv', pIzv[2]!.id, 'goal', 21),
  ev('m2', 'gru', pGru[1]!.id, 'goal', 6),
  ev('m2', 'gru', pGru[4]!.id, 'goal', 15),
  ev('m2', 'gru', pGru[1]!.id, 'goal', 24),
  // w1 finished LAS 1:0 MOS
  ev('w1', 'las', pLas[0]!.id, 'goal', 12),
];

const sponsors: Sponsor[] = [
  { id: 's1', tournament_id: T, name: 'Elektroprivreda HZHB', tier: 'gold', logo_url: null, is_active: true, sort_order: 0 },
  { id: 's2', tournament_id: T, name: 'Euroherc', tier: 'silver', logo_url: null, is_active: true, sort_order: 1 },
  { id: 's3', tournament_id: T, name: 'HT Eronet', tier: 'silver', logo_url: null, is_active: true, sort_order: 2 },
  { id: 's4', tournament_id: T, name: 'JYSK', tier: 'bronze', logo_url: null, is_active: true, sort_order: 3 },
];

const locations: LocationRow[] = [
  { id: 'l1', tournament_id: T, type: 'hall', name: 'Dvorana Bijeli Brijeg', description: 'Glavna dvorana', lat: 43.337, lng: 17.793, sort_order: 0 },
  { id: 'l2', tournament_id: T, type: 'tent', name: 'Šator (parking)', description: 'Druženje ispred dvorane', lat: 43.3372, lng: 17.7932, sort_order: 1 },
  { id: 'l3', tournament_id: T, type: 'dinner', name: 'Restoran Mostar', description: 'Završna večera', lat: 43.343, lng: 17.808, sort_order: 2 },
  { id: 'l4', tournament_id: T, type: 'hotel', name: 'Hotel Mostar', description: null, lat: 43.341, lng: 17.814, sort_order: 3 },
  { id: 'l5', tournament_id: T, type: 'hotel', name: 'Hotel Bristol', description: null, lat: 43.339, lng: 17.81, sort_order: 4 },
];

const program: ProgramItem[] = [
  { id: 'pr1', tournament_id: T, day_id: 'd1', time: '19:00:00', title: 'Dolazak i registracija', location_id: 'l2', sort_order: 0 },
  { id: 'pr2', tournament_id: T, day_id: D2, time: '21:00:00', title: 'Druženje uz večeru', location_id: 'l2', sort_order: 0 },
  { id: 'pr3', tournament_id: T, day_id: D3, time: '20:00:00', title: 'Završna večera i dodjela', location_id: 'l3', sort_order: 0 },
];

const registrations: Registration[] = [
  {
    id: 'r1', tournament_id: T, team_name: 'Posušje veterani', gender: 'm', rep_name: 'Ivan Lučić',
    rep_email: 'ivan@posusje.ba', player_count: 4, created_by: null, status: 'pending', approved_team_id: null,
    processed_at: null, processed_by: null, created_at: '2026-05-01T10:00:00Z',
    players: [
      { name: 'Slaven Boban', number: 1 },
      { name: 'Mate Jelić', number: 4 },
      { name: 'Filip Galić', number: 7 },
      { name: 'Nikola Erceg', number: null },
    ],
  },
  {
    id: 'r2', tournament_id: T, team_name: 'ŽRK Lasta', gender: 'z', rep_name: 'Maja Kovač',
    rep_email: 'maja@lasta.ba', player_count: 3, created_by: null, status: 'pending', approved_team_id: null,
    processed_at: null, processed_by: null, created_at: '2026-05-02T10:00:00Z',
    players: [
      { name: 'Maja Kovač', number: 1 },
      { name: 'Iva Bošnjak', number: 5 },
      { name: 'Petra Lulić', number: 9 },
    ],
  },
  { id: 'r3', tournament_id: T, team_name: 'VHMRK Zrinjski', gender: 'm', rep_name: 'Ivan Ivić', rep_email: 'zri@klub.ba', player_count: 14, players: [], created_by: null, status: 'approved', approved_team_id: 'zri', processed_at: '2026-04-01T12:00:00Z', processed_by: 'u1', created_at: '2026-04-01T10:00:00Z' },
  { id: 'r4', tournament_id: T, team_name: 'Grude Legende', gender: 'm', rep_name: 'Marko Marić', rep_email: 'gru@klub.ba', player_count: 12, players: [], created_by: null, status: 'approved', approved_team_id: 'gru', processed_at: '2026-04-02T12:00:00Z', processed_by: 'u1', created_at: '2026-04-02T10:00:00Z' },
];

const notifications: NotificationLog[] = [
  { id: 'n1', tournament_id: T, type: 'custom', audience: 'all', title: 'Polufinale počinje', body: null, push_sent_at: null, sent_at: '2026-06-06T17:40:00Z' },
  { id: 'n2', tournament_id: T, type: 'team_playing_soon', audience: 'team:zri', title: 'Vaša utakmica za 30 min', body: null, push_sent_at: null, sent_at: '2026-06-06T12:10:00Z' },
];

const appUsers: { id: string; email: string; role: string; team_id: string | null }[] = [
  { id: 'u1', email: 'admin@zrinjski.ba', role: 'admin', team_id: null },
  { id: 'u2', email: 'delegat@zrinjski.ba', role: 'delegate', team_id: null },
];

/** Mutabilni singleton — DEMO grana u data.ts radi nad ovim. */
// Galerija u demo modu kreće prazna — fotografije se dodaju uploadom u sesiji.
const gallery: GalleryPhoto[] = [];

const mvpVotes: MvpVote[] = [];

const contacts: Contact[] = [
  { id: 'c1', tournament_id: T, name: 'Ivan Ivić', role: 'Direktor turnira', phone: '+387 63 111 222', sort_order: 0, created_at: '2026-01-01T00:00:00Z' },
  { id: 'c2', tournament_id: T, name: 'Marko Marić', role: 'Delegat', phone: '+387 63 333 444', sort_order: 1, created_at: '2026-01-01T00:00:00Z' },
];

// Kontakti predstavnika — odvojeno od ekipa, kao i u pravoj bazi.
const teamContacts: { team_id: string; rep_email: string | null; updated_at: string }[] = teams.map((t) => ({
  team_id: t.id,
  rep_email: `${(t.short_code ?? t.id).toLowerCase()}@klub.ba`,
  updated_at: '2026-01-01T00:00:00Z',
}));

export const db = {
  tournament,
  days,
  groups,
  teams,
  players,
  matches,
  events,
  sponsors,
  locations,
  program,
  registrations,
  notifications,
  appUsers,
  gallery,
  mvpVotes,
  contacts,
  teamContacts,
};
