// data.ts — pristup podacima za web admin.
// Dvije grane: DEMO (lokalni podaci u memoriji, demoDb) i Supabase (pravi backend).
// DEMO grana omogućuje pregled cijelog admina bez baze; ukloni se kad DEMO = false.
import type {
  Day,
  Gender,
  Grp,
  Match,
  MatchEvent,
  NotificationLog,
  Player,
  Registration,
  RegistrationStatus,
  Sponsor,
  Team,
  Tournament,
  TablesInsert,
  TablesUpdate,
} from '@zrinjski/core';
import { DEMO, supabase } from './supabase';
import { db, genId } from './demoDb';

const ASSETS_BUCKET = 'public-assets';

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

function patch<T extends { id: string }>(arr: T[], id: string, p: Partial<T>): void {
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr[i] = { ...arr[i]!, ...p };
}

// ── Turnir / dani ──────────────────────────────────────────────────────────
export async function fetchActiveTournament(): Promise<Tournament | null> {
  if (DEMO) return db.tournament;
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
  if (DEMO) return db.days.filter((d) => d.tournament_id === tournamentId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('day')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true })
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateTournament(id: string, p: TablesUpdate<'tournament'>): Promise<void> {
  if (DEMO) {
    db.tournament = { ...db.tournament, ...p } as Tournament;
    return;
  }
  const { error } = await client().from('tournament').update(p).eq('id', id);
  if (error) throw error;
}

export async function createDay(tournamentId: string, date: string, sortOrder: number): Promise<Day> {
  if (DEMO) {
    const d: Day = { id: genId('d'), tournament_id: tournamentId, date, first_match_time: null, sort_order: sortOrder };
    db.days.push(d);
    return d;
  }
  const { data, error } = await client()
    .from('day')
    .insert({ tournament_id: tournamentId, date, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateDay(id: string, p: TablesUpdate<'day'>): Promise<void> {
  if (DEMO) return patch(db.days, id, p as Partial<Day>);
  const { error } = await client().from('day').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteDay(id: string): Promise<void> {
  if (DEMO) {
    db.days = db.days.filter((d) => d.id !== id);
    return;
  }
  const { error } = await client().from('day').delete().eq('id', id);
  if (error) throw error;
}

// ── Satnica ──────────────────────────────────────────────────────────────
export async function fetchMatchesForSchedule(tournamentId: string): Promise<Match[]> {
  if (DEMO) return db.matches.filter((m) => m.tournament_id === tournamentId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function applyScheduledTimes(updates: { id: string; scheduledTime: string }[]): Promise<void> {
  if (DEMO) {
    for (const u of updates) patch(db.matches, u.id, { scheduled_time: u.scheduledTime });
    return;
  }
  const c = client();
  const results = await Promise.all(
    updates.map((u) => c.from('match').update({ scheduled_time: u.scheduledTime }).eq('id', u.id))
  );
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) throw firstErr;
}

// ── Grupe ────────────────────────────────────────────────────────────────
export async function fetchGroups(tournamentId: string, gender: Gender): Promise<Grp[]> {
  if (DEMO)
    return db.groups
      .filter((g) => g.tournament_id === tournamentId && g.gender === gender)
      .sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('grp')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createGroup(tournamentId: string, gender: Gender, name: string, sortOrder: number): Promise<Grp> {
  if (DEMO) {
    const g: Grp = { id: genId('g'), tournament_id: tournamentId, gender, name, sort_order: sortOrder };
    db.groups.push(g);
    return g;
  }
  const { data, error } = await client()
    .from('grp')
    .insert({ tournament_id: tournamentId, gender, name, sort_order: sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGroup(id: string): Promise<void> {
  if (DEMO) {
    db.groups = db.groups.filter((g) => g.id !== id);
    db.teams = db.teams.map((t) => (t.group_id === id ? { ...t, group_id: null } : t));
    return;
  }
  const { error } = await client().from('grp').delete().eq('id', id);
  if (error) throw error;
}

// ── Ekipe ────────────────────────────────────────────────────────────────
export async function fetchTeams(tournamentId: string, gender: Gender): Promise<Team[]> {
  if (DEMO)
    return db.teams
      .filter((t) => t.tournament_id === tournamentId && t.gender === gender)
      .sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  const { data, error } = await client()
    .from('team')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('gender', gender)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Sve ekipe turnira (oba spola) — za grbove/mape u raznim ekranima. */
export async function fetchAllTeams(tournamentId: string): Promise<Team[]> {
  if (DEMO) return db.teams.filter((t) => t.tournament_id === tournamentId);
  const { data, error } = await client().from('team').select('*').eq('tournament_id', tournamentId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTeam(id: string): Promise<Team | null> {
  if (DEMO) return db.teams.find((t) => t.id === id) ?? null;
  const { data, error } = await client().from('team').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTeam(row: TablesInsert<'team'>): Promise<Team> {
  if (DEMO) {
    const t: Team = {
      id: genId('team'),
      tournament_id: row.tournament_id,
      name: row.name,
      short_code: row.short_code ?? null,
      color: row.color ?? null,
      gender: row.gender,
      group_id: row.group_id ?? null,
      coach_name: row.coach_name ?? null,
      rep_email: row.rep_email ?? null,
      logo_url: row.logo_url ?? null,
      created_at: new Date().toISOString(),
    };
    db.teams.push(t);
    return t;
  }
  const { data, error } = await client().from('team').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateTeam(id: string, p: TablesUpdate<'team'>): Promise<void> {
  if (DEMO) return patch(db.teams, id, p as Partial<Team>);
  const { error } = await client().from('team').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  if (DEMO) {
    db.teams = db.teams.filter((t) => t.id !== id);
    db.players = db.players.filter((p) => p.team_id !== id);
    return;
  }
  const { error } = await client().from('team').delete().eq('id', id);
  if (error) throw error;
}

// ── Igrači ───────────────────────────────────────────────────────────────
export async function fetchPlayers(teamId: string): Promise<Player[]> {
  if (DEMO) return db.players.filter((p) => p.team_id === teamId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('player')
    .select('*')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createPlayer(row: TablesInsert<'player'>): Promise<Player> {
  if (DEMO) {
    const p: Player = {
      id: genId('p'),
      team_id: row.team_id,
      number: row.number ?? null,
      name: row.name,
      is_captain: row.is_captain ?? false,
      sort_order: row.sort_order ?? 0,
    };
    db.players.push(p);
    return p;
  }
  const { data, error } = await client().from('player').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id: string, p: TablesUpdate<'player'>): Promise<void> {
  if (DEMO) return patch(db.players, id, p as Partial<Player>);
  const { error } = await client().from('player').update(p).eq('id', id);
  if (error) throw error;
}

export async function deletePlayer(id: string): Promise<void> {
  if (DEMO) {
    db.players = db.players.filter((p) => p.id !== id);
    return;
  }
  const { error } = await client().from('player').delete().eq('id', id);
  if (error) throw error;
}

// ── Generiranje grupnih utakmica ───────────────────────────────────────────
export async function fetchGroupsWithMatches(tournamentId: string): Promise<Set<string>> {
  if (DEMO)
    return new Set(
      db.matches
        .filter((m) => m.tournament_id === tournamentId && m.stage === 'group' && m.grp_id)
        .map((m) => m.grp_id as string)
    );
  const { data, error } = await client()
    .from('match')
    .select('grp_id')
    .eq('tournament_id', tournamentId)
    .eq('stage', 'group')
    .not('grp_id', 'is', null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.grp_id).filter((x): x is string => !!x));
}

export async function maxMatchSortOrder(tournamentId: string): Promise<number> {
  if (DEMO)
    return db.matches
      .filter((m) => m.tournament_id === tournamentId)
      .reduce((mx, m) => Math.max(mx, m.sort_order), -1);
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
  if (DEMO) {
    for (const r of rows) {
      db.matches.push({
        id: genId('m'),
        tournament_id: r.tournament_id,
        day_id: r.day_id ?? null,
        gender: r.gender,
        stage: r.stage ?? 'group',
        grp_id: r.grp_id ?? null,
        home_team_id: r.home_team_id ?? null,
        away_team_id: r.away_team_id ?? null,
        home_placeholder: r.home_placeholder ?? null,
        away_placeholder: r.away_placeholder ?? null,
        home_score: r.home_score ?? 0,
        away_score: r.away_score ?? 0,
        scheduled_time: r.scheduled_time ?? null,
        status: r.status ?? 'scheduled',
        sort_order: r.sort_order ?? 0,
        best_player_id: r.best_player_id ?? null,
        current_minute: r.current_minute ?? null,
        current_half: r.current_half ?? null,
      });
    }
    return rows.length;
  }
  const { error, count } = await client().from('match').insert(rows, { count: 'exact' });
  if (error) throw error;
  return count ?? rows.length;
}

// ── Unos uživo ─────────────────────────────────────────────────────────────
export async function fetchMatch(id: string): Promise<Match | null> {
  if (DEMO) return db.matches.find((m) => m.id === id) ?? null;
  const { data, error } = await client().from('match').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchEnterableMatches(tournamentId: string): Promise<Match[]> {
  if (DEMO)
    return db.matches
      .filter((m) => m.tournament_id === tournamentId && (m.status === 'scheduled' || m.status === 'live'))
      .sort((a, b) => (a.scheduled_time ?? '').localeCompare(b.scheduled_time ?? '') || a.sort_order - b.sort_order);
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

export async function fetchFinishedMatches(tournamentId: string): Promise<Match[]> {
  if (DEMO)
    return db.matches
      .filter((m) => m.tournament_id === tournamentId && m.status === 'finished')
      .sort((a, b) => (b.scheduled_time ?? '').localeCompare(a.scheduled_time ?? ''));
  const { data, error } = await client()
    .from('match')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('status', 'finished')
    .order('scheduled_time', { ascending: false, nullsFirst: false })
    .order('sort_order', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlayersByTeams(teamIds: string[]): Promise<Player[]> {
  if (teamIds.length === 0) return [];
  if (DEMO) return db.players.filter((p) => teamIds.includes(p.team_id)).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('player')
    .select('*')
    .in('team_id', teamIds)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchEvents(matchId: string): Promise<MatchEvent[]> {
  if (DEMO) return db.events.filter((e) => e.match_id === matchId);
  const { data, error } = await client()
    .from('match_event')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertEvent(row: TablesInsert<'match_event'>): Promise<MatchEvent> {
  if (DEMO) {
    const e: MatchEvent = {
      id: genId('e'),
      match_id: row.match_id,
      team_id: row.team_id,
      player_id: row.player_id ?? null,
      type: row.type,
      minute: row.minute,
      created_at: new Date().toISOString(),
    };
    db.events.push(e);
    if (e.type === 'goal') {
      const m = db.matches.find((x) => x.id === e.match_id);
      if (m) patch(db.matches, m.id, e.team_id === m.home_team_id ? { home_score: m.home_score + 1 } : { away_score: m.away_score + 1 });
    }
    return e;
  }
  const { data, error } = await client().from('match_event').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  if (DEMO) {
    const e = db.events.find((x) => x.id === id);
    db.events = db.events.filter((x) => x.id !== id);
    if (e && e.type === 'goal') {
      const m = db.matches.find((x) => x.id === e.match_id);
      if (m)
        patch(
          db.matches,
          m.id,
          e.team_id === m.home_team_id
            ? { home_score: Math.max(0, m.home_score - 1) }
            : { away_score: Math.max(0, m.away_score - 1) }
        );
    }
    return;
  }
  const { error } = await client().from('match_event').delete().eq('id', id);
  if (error) throw error;
}

export async function updateMatch(id: string, p: TablesUpdate<'match'>): Promise<void> {
  if (DEMO) return patch(db.matches, id, p as Partial<Match>);
  const { error } = await client().from('match').update(p).eq('id', id);
  if (error) throw error;
}

// ── Sponzori ───────────────────────────────────────────────────────────────
export async function fetchSponsors(tournamentId: string): Promise<Sponsor[]> {
  if (DEMO) return db.sponsors.filter((s) => s.tournament_id === tournamentId).sort((a, b) => a.sort_order - b.sort_order);
  const { data, error } = await client()
    .from('sponsor')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('tier', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSponsor(row: TablesInsert<'sponsor'>): Promise<Sponsor> {
  if (DEMO) {
    const s: Sponsor = {
      id: genId('s'),
      tournament_id: row.tournament_id,
      name: row.name,
      tier: row.tier,
      logo_url: row.logo_url ?? null,
      is_active: row.is_active ?? true,
      sort_order: row.sort_order ?? 0,
    };
    db.sponsors.push(s);
    return s;
  }
  const { data, error } = await client().from('sponsor').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

export async function updateSponsor(id: string, p: TablesUpdate<'sponsor'>): Promise<void> {
  if (DEMO) return patch(db.sponsors, id, p as Partial<Sponsor>);
  const { error } = await client().from('sponsor').update(p).eq('id', id);
  if (error) throw error;
}

export async function deleteSponsor(id: string): Promise<void> {
  if (DEMO) {
    db.sponsors = db.sponsors.filter((s) => s.id !== id);
    return;
  }
  const { error } = await client().from('sponsor').delete().eq('id', id);
  if (error) throw error;
}

// ── Obavijesti ─────────────────────────────────────────────────────────────
export async function fetchNotifications(tournamentId: string): Promise<NotificationLog[]> {
  if (DEMO)
    return db.notifications
      .filter((n) => n.tournament_id === tournamentId)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  const { data, error } = await client()
    .from('notification_log')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sent_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function insertNotification(row: TablesInsert<'notification_log'>): Promise<NotificationLog> {
  if (DEMO) {
    const n: NotificationLog = {
      id: genId('n'),
      tournament_id: row.tournament_id,
      type: row.type,
      audience: row.audience,
      title: row.title,
      body: row.body ?? null,
      sent_at: new Date().toISOString(),
    };
    db.notifications.unshift(n);
    return n;
  }
  const { data, error } = await client().from('notification_log').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

// ── Prijave ────────────────────────────────────────────────────────────────
export async function fetchRegistrations(tournamentId: string): Promise<Registration[]> {
  if (DEMO)
    return db.registrations
      .filter((r) => r.tournament_id === tournamentId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { data, error } = await client()
    .from('registration')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateRegistrationStatus(id: string, status: RegistrationStatus): Promise<void> {
  if (DEMO) return patch(db.registrations, id, { status });
  const { error } = await client().from('registration').update({ status }).eq('id', id);
  if (error) throw error;
}

// ── Upload (Storage) ─────────────────────────────────────────────────────────
export async function uploadPublicAsset(file: File, folder: string): Promise<string> {
  if (DEMO) return URL.createObjectURL(file); // lokalni pregled u sesiji
  const c = client();
  const ext = file.name.split('.').pop() || 'png';
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await c.storage.from(ASSETS_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return c.storage.from(ASSETS_BUCKET).getPublicUrl(path).data.publicUrl;
}
