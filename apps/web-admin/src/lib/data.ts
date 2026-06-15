// data.ts — upiti prema Supabase za turnir, dane i utakmice (web admin).
import type { Day, Match, Tournament, TablesUpdate } from '@zrinjski/core';
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
