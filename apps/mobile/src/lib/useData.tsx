// useData.tsx — jedinstveni izvor podataka za app (korisnik + mobilni admin).
// Dvije grane:
//  • ŽIVO (isSupabaseConfigured): učitava iz Supabasea + realtime (match/match_event),
//    a admin mutatori pišu u bazu (DB trigger sam diže rezultat na gol).
//  • DEMO (bez .env): lokalni demo podaci u stanju (offline pregled).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import type {
  Day,
  EventType,
  Grp,
  LocationRow,
  Match,
  MatchEvent,
  Player,
  ProgramItem,
  Sponsor,
  Team,
  Tournament,
} from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { isSupabaseConfigured, supabase } from './supabase';
import {
  demoDays,
  demoEvents,
  demoGallery,
  demoGroups,
  demoLocations,
  demoMatches,
  demoPlayers,
  demoProgram,
  demoSponsors,
  demoTeams,
  demoTournament,
} from './demo';

export type GalleryItem = { id: string; day_id: string; color: string };

export type DataStore = {
  loading: boolean;
  demo: boolean;
  tournament: Tournament | null;
  days: Day[];
  groups: Grp[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  sponsors: Sponsor[];
  locations: LocationRow[];
  program: ProgramItem[];
  gallery: GalleryItem[];
  teamById: (id: string | null | undefined) => Team | undefined;
  playersOf: (teamId: string) => Player[];
  matchById: (id: string) => Match | undefined;
  eventsOf: (matchId: string) => MatchEvent[];
  startMatch: (id: string) => void;
  finishMatch: (id: string) => void;
  adjustScore: (id: string, isHome: boolean, delta: number) => void;
  setMinute: (id: string, minute: number) => void;
  addEvent: (matchId: string, teamId: string, playerId: string | null, type: EventType, minute: number) => void;
  undoLastEvent: (matchId: string) => void;
};

const DataContext = createContext<DataStore | null>(null);
const LIVE = isSupabaseConfigured;

let evtSeq = 0;
const newId = () => `evt-${Date.now()}-${++evtSeq}`;

const GALLERY_COLORS = ['#E11D2A', '#2D6CDF', '#6A1FB0', '#1F7A8C', '#C2410C', '#0D9488'];

type AllData = {
  tournament: Tournament | null;
  days: Day[];
  groups: Grp[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  sponsors: Sponsor[];
  locations: LocationRow[];
  program: ProgramItem[];
  gallery: GalleryItem[];
};

async function loadAll(): Promise<AllData> {
  const sb = supabase!;
  const { data: tournament } = await sb
    .from('tournament')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const empty: AllData = {
    tournament: tournament ?? null,
    days: [], groups: [], teams: [], players: [], matches: [],
    events: [], sponsors: [], locations: [], program: [], gallery: [],
  };
  if (!tournament) return empty;
  const tid = tournament.id;

  const [days, groups, teams, matches, sponsors, locations, program, gallery] = await Promise.all([
    sb.from('day').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('grp').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('team').select('*').eq('tournament_id', tid).order('name'),
    sb.from('match').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('sponsor').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('location').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('program_item').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('gallery_photo').select('*').eq('tournament_id', tid),
  ]);

  const teamIds = (teams.data ?? []).map((t) => t.id);
  const matchIds = (matches.data ?? []).map((m) => m.id);
  const [players, events] = await Promise.all([
    teamIds.length ? sb.from('player').select('*').in('team_id', teamIds).order('sort_order') : Promise.resolve({ data: [] }),
    matchIds.length ? sb.from('match_event').select('*').in('match_id', matchIds).order('created_at') : Promise.resolve({ data: [] }),
  ]);

  return {
    tournament,
    days: days.data ?? [],
    groups: groups.data ?? [],
    teams: teams.data ?? [],
    players: (players.data ?? []) as Player[],
    matches: matches.data ?? [],
    events: (events.data ?? []) as MatchEvent[],
    sponsors: sponsors.data ?? [],
    locations: locations.data ?? [],
    program: program.data ?? [],
    gallery: (gallery.data ?? []).map((g, i) => ({
      id: g.id,
      day_id: g.day_id ?? '',
      color: GALLERY_COLORS[i % GALLERY_COLORS.length]!,
    })),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(LIVE);
  const [data, setData] = useState<AllData>(() =>
    LIVE
      ? { tournament: null, days: [], groups: [], teams: [], players: [], matches: [], events: [], sponsors: [], locations: [], program: [], gallery: [] }
      : {
          tournament: demoTournament,
          days: demoDays,
          groups: demoGroups,
          teams: demoTeams,
          players: demoPlayers,
          matches: demoMatches,
          events: demoEvents,
          sponsors: demoSponsors,
          locations: demoLocations,
          program: demoProgram,
          gallery: demoGallery,
        }
  );

  // Ponovno povuci utakmice + događaje iz baze (realtime osvježenje i oporavak od greške).
  const refreshMatchesEvents = useCallback(async () => {
    const sb = supabase;
    if (!sb) return;
    try {
      const tid = (await sb.from('tournament').select('id').limit(1).maybeSingle()).data?.id;
      if (!tid) return;
      const ms = await sb.from('match').select('*').eq('tournament_id', tid).order('sort_order');
      const matchIds = (ms.data ?? []).map((m) => m.id);
      const ev = matchIds.length
        ? await sb.from('match_event').select('*').in('match_id', matchIds).order('created_at')
        : { data: [] };
      setData((d) => ({ ...d, matches: ms.data ?? d.matches, events: (ev.data ?? []) as MatchEvent[] }));
    } catch {
      /* mrežna greška — sljedeći realtime event ili ručni refresh pokušava ponovno */
    }
  }, []);

  // Obavijest zapisničaru da upis NIJE prošao + povratak ekrana na stvarno stanje baze.
  const { t } = useT();
  const notifyWriteError = useCallback(() => {
    const msg = t('admin.writeError');
    if (Platform.OS === 'web') window.alert(msg);
    else Alert.alert('⚠️', msg);
    void refreshMatchesEvents();
  }, [t, refreshMatchesEvents]);

  // ŽIVO: učitavanje + realtime na match/match_event.
  useEffect(() => {
    if (!LIVE || !supabase) return;
    let active = true;
    const sb = supabase;

    loadAll()
      .then((all) => {
        if (active) setData(all);
      })
      .catch(() => {
        /* mreža pala pri startu — ekrani pokazuju prazna stanja umjesto vječnog učitavanja */
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const ch = sb
      .channel('public-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match' }, () => void refreshMatchesEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_event' }, () => void refreshMatchesEvents())
      .subscribe();

    return () => {
      active = false;
      void sb.removeChannel(ch);
    };
  }, [refreshMatchesEvents]);

  const value = useMemo<DataStore>(() => {
    const { teams, players, matches, events } = data;
    const teamIndex = new Map(teams.map((t) => [t.id, t] as const));
    const sb = supabase;

    const patchMatchLocal = (id: string, patch: Partial<Match>) =>
      setData((d) => ({ ...d, matches: d.matches.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

    // Provjeri je li upis stvarno prošao. VAŽNO: RLS blokada na UPDATE/DELETE ne
    // vraća grešku nego "uspjeh" s 0 redova — zato upiti nose .select('id') pa
    // prazan rezultat također tretiramo kao neuspjeh.
    const checkWrite = (op: PromiseLike<{ error: unknown; data: unknown[] | null }>) => {
      void Promise.resolve(op).then(
        ({ error, data: rows }) => {
          if (error || !rows || rows.length === 0) notifyWriteError();
        },
        () => notifyWriteError()
      );
    };

    return {
      loading,
      demo: !LIVE,
      ...data,
      teamById: (id) => (id ? teamIndex.get(id) : undefined),
      playersOf: (teamId) => players.filter((p) => p.team_id === teamId),
      matchById: (id) => matches.find((mm) => mm.id === id),
      eventsOf: (matchId) => events.filter((e) => e.match_id === matchId),

      startMatch: (id) => {
        patchMatchLocal(id, { status: 'live', current_half: 1, current_minute: 0 });
        if (LIVE && sb)
          checkWrite(sb.from('match').update({ status: 'live', current_half: 1, current_minute: 0 }).eq('id', id).select('id'));
      },
      finishMatch: (id) => {
        patchMatchLocal(id, { status: 'finished' });
        if (LIVE && sb) checkWrite(sb.from('match').update({ status: 'finished' }).eq('id', id).select('id'));
      },
      setMinute: (id, minute) => {
        // Kozmetički tik (svake minute) — bez alarma da ne spamamo; greška se vidi na pravim akcijama.
        patchMatchLocal(id, { current_minute: minute });
        if (LIVE && sb) void sb.from('match').update({ current_minute: minute }).eq('id', id);
      },
      adjustScore: (id, isHome, delta) => {
        const m = matches.find((x) => x.id === id);
        if (!m) return;
        const next = isHome
          ? { home_score: Math.max(0, m.home_score + delta) }
          : { away_score: Math.max(0, m.away_score + delta) };
        patchMatchLocal(id, next);
        if (LIVE && sb) checkWrite(sb.from('match').update(next).eq('id', id).select('id'));
      },
      addEvent: (matchId, teamId, playerId, type, minute) => {
        // Optimistično lokalno (gol diže rezultat); u živo modu DB trigger radi isto na serveru.
        const ev: MatchEvent = { id: newId(), match_id: matchId, team_id: teamId, player_id: playerId, type, minute, created_at: new Date().toISOString() };
        setData((d) => {
          const matchesNext =
            type === 'goal'
              ? d.matches.map((m) => {
                  if (m.id !== matchId) return m;
                  const isHome = teamId === m.home_team_id;
                  return { ...m, home_score: m.home_score + (isHome ? 1 : 0), away_score: m.away_score + (isHome ? 0 : 1) };
                })
              : d.matches;
          return { ...d, events: [...d.events, ev], matches: matchesNext };
        });
        if (LIVE && sb)
          checkWrite(
            sb.from('match_event').insert({ match_id: matchId, team_id: teamId, player_id: playerId, type, minute }).select('id')
          );
      },
      undoLastEvent: (matchId) => {
        const matchEvents = events.filter((e) => e.match_id === matchId);
        const last = matchEvents[matchEvents.length - 1];
        if (!last) return;
        setData((d) => {
          const matchesNext =
            last.type === 'goal'
              ? d.matches.map((m) => {
                  if (m.id !== matchId) return m;
                  const isHome = last.team_id === m.home_team_id;
                  return { ...m, home_score: Math.max(0, m.home_score - (isHome ? 1 : 0)), away_score: Math.max(0, m.away_score - (isHome ? 0 : 1)) };
                })
              : d.matches;
          return { ...d, events: d.events.filter((e) => e.id !== last.id), matches: matchesNext };
        });
        if (LIVE && sb) {
          const client = sb;
          const doDelete = async () => {
            // Ako je zadnji događaj još lokalni (optimistični) id, obriši najnoviji DB red te utakmice.
            let targetId = last.id;
            if (targetId.startsWith('evt-')) {
              const { data: rows } = await client
                .from('match_event')
                .select('id')
                .eq('match_id', matchId)
                .order('created_at', { ascending: false })
                .limit(1);
              targetId = rows?.[0]?.id ?? '';
            }
            if (!targetId) {
              notifyWriteError();
              return;
            }
            const { error, data: rows } = await client.from('match_event').delete().eq('id', targetId).select('id');
            if (error || !rows || rows.length === 0) notifyWriteError();
          };
          doDelete().catch(() => notifyWriteError());
        }
      },
    };
  }, [data, loading, notifyWriteError]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside <DataProvider>');
  return ctx;
}
