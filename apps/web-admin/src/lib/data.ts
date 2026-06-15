// data.ts — upiti prema Supabase za turnir, dane i utakmice (web admin).
import type {
  Day,
  Gender,
  Grp,
  Match,
  MatchEvent,
  Player,
  Team,
  Tournament,
  TablesInsert,
  TablesUpdate,
} from '@zrinjski/core';
import { supabase } from './supabase';

export class NotConfiguredError extends Error {
  constructor() {
    super('Supabase nije konfiguriran.');
    this.name = 'NotConfiguredError';
  }
}

function client() {
  if (!supabase) throw new NotConfiguredError();
  return supabase;
}

/** Aktivni turnir (jedan red; uzmi najstariji). */
export async function fetchActiveTournament(): Promise<Tournament | null> {
  const { data, error } = await client()
    .from('tournament')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchDays(tournamentId: string): Promise<Day[]> {
  const { data, error } = await client()
    .from('day')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true })
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateTournament(id: string, patch: TablesUpdate<'tournament'>): Promise<void> {
  const { error } = await client().from('tournament').update(patch).eq('id', id);
  if (error) throw error;
}

/** Dodaj dan. sort_order = na kraj liste. */
export async function createDay(
  tournamentId: string,
  date: string,
  sortOrder: number
): Promise<Day> {
  const { data, error } = await client()
    .from('day')
    .insert({ tournament_id: tournamentId, date, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateDay(id: string, patch: TablesUpdate<'day'>): Promise<void> {
  const { error } = await client().from('day').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteDay(id: string): Promise<void> {
  const { error } = await client().from('day').delete().eq('id', id);
  if (error) throw error;
}

/** Utakmice za satnicu (poredane po danu pa po sort_order). */
export async function fetchMatchesForSchedule(tournamentId: string): Promise<Match[]> {
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Spremi izračunata vremena: pojedinačni UPDATE po utakmici. */
export async function applyScheduledTimes(
  updates: { id: string; scheduledTime: string }[]
): Promise<void> {
  const c = client();
  const results = await Promise.all(
    updates.map((u) => c.from('match').update({ scheduled_time: u.scheduledTime }).eq('id', u.id))
  );
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) throw firstErr;
}

// ── Grupe ────────────────────────────────────────────────────────────────
export async function fetchGroups(tournamentId: string, gender: Gender): Promise<Grp[]> {
  const { data, error } = await client()
    .from('grp')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(
  tournamentId: string,
  gender: Gender,
  name: string,
  sortOrder: number
): Promise<Grp> {
  const { data, error } = await client()
    .from('grp')
    .insert({ tournament_id: tournamentId, gender, name, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await client().from('grp').delete().eq('id', id);
  if (error) throw error;
}

// ── Ekipe ────────────────────────────────────────────────────────────────
export async function fetchTeams(tournamentId: string, gender: Gender): Promise<Team[]> {
  const { data, error } = await client()
    .from('team')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTeam(row: TablesInsert<'team'>): Promise<Team> {
  const { data, error } = await client().from('team').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateTeam(id: string, patch: TablesUpdate<'team'>): Promise<void> {
  const { error } = await client().from('team').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await client().from('team').delete().eq('id', id);
  if (error) throw error;
}

// ── Igrači ───────────────────────────────────────────────────────────────
export async function fetchPlayers(teamId: string): Promise<Player[]> {
  const { data, error } = await client()
    .from('player')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlayer(row: TablesInsert<'player'>): Promise<Player> {
  const { data, error } = await client().from('player').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id: string, patch: TablesUpdate<'player'>): Promise<void> {
  const { error } = await client().from('player').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await client().from('player').delete().eq('id', id);
  if (error) throw error;
}

// ── Generiranje grupnih utakmica ───────────────────────────────────────────
/** ID-evi grupa koje već imaju barem jednu utakmicu (da ne dupliramo). */
export async function fetchGroupsWithMatches(tournamentId: string): Promise<Set<string>> {
  const { data, error } = await client()
    .from('match')
    .select('grp_id')
    .eq('tournament_id', tournamentId)
    .eq('stage', 'group')
    .not('grp_id', 'is', null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.grp_id).filter((x): x is string => !!x));
}

/** Najveći postojeći sort_order za utakmice (za nastavak numeracije). */
export async function maxMatchSortOrder(tournamentId: string): Promise<number> {
  const { data, error } = await client()
    .from('match')
    .select('sort_order')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.sort_order ?? -1;
}

export async function insertMatches(rows: TablesInsert<'match'>[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { error, count } = await client().from('match').insert(rows, { count: 'exact' });
  if (error) throw error;
  return count ?? rows.length;
}

// ── Unos uživo ─────────────────────────────────────────────────────────────
export async function fetchMatch(id: string): Promise<Match | null> {
  const { data, error } = await client().from('match').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Utakmice koje se mogu unositi (najavljene + uživo), s vremenom — za izbornik. */
export async function fetchEnterableMatches(tournamentId: string): Promise<Match[]> {
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_time', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayersByTeams(teamIds: string[]): Promise<Player[]> {
  if (teamIds.length === 0) return [];
  const { data, error } = await client()
    .from('player')
    .select('*')
    .in('team_id', teamIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvents(matchId: string): Promise<MatchEvent[]> {
  const { data, error } = await client()
    .from('match_event')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertEvent(row: TablesInsert<'match_event'>): Promise<MatchEvent> {
  const { data, error } = await client().from('match_event').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await client().from('match_event').delete().eq('id', id);
  if (error) throw error;
}

export async function updateMatch(id: string, patch: TablesUpdate<'match'>): Promise<void> {
  const { error } = await client().from('match').update(patch).eq('id', id);
  if (error) throw error;
}
