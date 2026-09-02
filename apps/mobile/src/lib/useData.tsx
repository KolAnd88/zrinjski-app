// useData.tsx — jedinstveni izvor podataka za app (korisnik + mobilni admin).
// Dvije grane:
//  • ŽIVO (isSupabaseConfigured): učitava iz Supabasea + realtime (match/match_event/team/day),
//    a admin mutatori pišu u bazu (DB trigger sam diže rezultat na gol).
//  • DEMO (bez .env): lokalni demo podaci u stanju (offline pregled).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import type {
  Day,
  EventType,
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
import { applyChange, type RowChange } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { isSupabaseConfigured, supabase } from './supabase';
import { enqueue, flushOutbox, loadOutbox } from './outbox';
import {
  demoDays,
  demoEvents,
  demoGallery,
  demoGroups,
  demoLocations,
  demoMatches,
  demoContacts,
  demoMvpResults,
  demoPlayers,
  demoProgram,
  demoSponsors,
  demoTeams,
  demoTournament,
} from './demo';

/** `url` je javni link na fotografiju; `color` je podloga dok se slika učitava. */
export type GalleryItem = { id: string; day_id: string; color: string; url: string | null };

export type DataStore = {
  loading: boolean;
  /** Početno učitavanje nije uspjelo (nema mreže?) — ponudi "Pokušaj ponovno". */
  loadError: boolean;
  /** Ručno osvježavanje u tijeku (pull-to-refresh). */
  reloading: boolean;
  /** Ponovno učitaj sve podatke iz baze. */
  reload: () => Promise<void>;
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
  /** Glasovi za najboljeg igraca. Baza vraca prazno dok admin ne zatvori glasanje. */
  mvpResults: MvpResult[];
  /** Kontakti organizatora — javni popis za Info tab. */
  contacts: Contact[];
  teamById: (id: string | null | undefined) => Team | undefined;
  playersOf: (teamId: string) => Player[];
  matchById: (id: string) => Match | undefined;
  eventsOf: (matchId: string) => MatchEvent[];
  startMatch: (id: string) => void;
  finishMatch: (id: string) => void;
  setMinute: (id: string, minute: number) => void;
  addEvent: (matchId: string, teamId: string, playerId: string | null, type: EventType, minute: number) => void;
  undoLastEvent: (matchId: string) => void;
};

const DataContext = createContext<DataStore | null>(null);
const LIVE = isSupabaseConfigured;

/**
 * UUID v4 za događaj. Isti ID vrijedi lokalno I u bazi — zato ponovljeno slanje
 * iz reda čekanja ne može napraviti duplikat, a poništavanje zna koji red
 * obrisati. (Stupac je uuid; raniji oblik "evt-…" ne bi ni prošao upis.)
 */
function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  mvpResults: MvpResult[];
  contacts: Contact[];
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
    events: [], sponsors: [], locations: [], program: [], gallery: [], mvpResults: [], contacts: [],
  };
  if (!tournament) return empty;
  const tid = tournament.id;

  const [days, groups, teams, matches, sponsors, locations, program, gallery, contacts] = await Promise.all([
    sb.from('day').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('grp').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('team').select('*').eq('tournament_id', tid).order('name'),
    sb.from('match').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('sponsor').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('location').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('program_item').select('*').eq('tournament_id', tid).order('sort_order'),
    sb.from('gallery_photo').select('*').eq('tournament_id', tid),
    sb.from('contact').select('*').eq('tournament_id', tid).order('sort_order'),
  ]);

  // Nagrada za najboljeg igraca: baza sama odlucuje smije li je pokazati.
  const mvp = await sb.rpc('mvp_results');

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
    mvpResults: (mvp.data ?? []) as MvpResult[],
    contacts: (contacts.data ?? []) as Contact[],
    gallery: (gallery.data ?? []).map((g, i) => ({
      id: g.id,
      day_id: g.day_id ?? '',
      color: GALLERY_COLORS[i % GALLERY_COLORS.length]!,
      url: g.storage_path ?? null,
    })),
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(LIVE);
  const [data, setData] = useState<AllData>(() =>
    LIVE
      ? { tournament: null, days: [], groups: [], teams: [], players: [], matches: [], events: [], sponsors: [], locations: [], program: [], gallery: [], mvpResults: [], contacts: [] }
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
          mvpResults: demoMvpResults,
          contacts: demoContacts,
        }
  );

  // Zadnje stanje dostupno unutar realtime rukovatelja, bez ponovne pretplate.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

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

  // Puno (ponovno) učitavanje — početno, pull-to-refresh i "Pokušaj ponovno".
  const [loadError, setLoadError] = useState(false);
  const [reloading, setReloading] = useState(false);
  const reload = useCallback(async () => {
    if (!LIVE) return;
    setReloading(true);
    try {
      // Prvo isprazni red čekanja pa učitaj — inače bi svježi podaci iz baze
      // pregazili akcije koje još nisu poslane.
      await flushOutbox();
      const all = await loadAll();
      setData(all);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReloading(false);
      setLoading(false);
    }
  }, []);

  /**
   * Primijeni jednu realtime promjenu na lokalni popis.
   *
   * Kad se ne može pouzdano primijeniti (nepotpun redak, nepoznat tip poruke),
   * povlači se puni popis — bolje jedno suvišno preuzimanje nego tiho krivi
   * rezultat na ekranu.
   */
  const primijeni = useCallback(
    (kljuc: 'matches' | 'events', promjena: RowChange<Match> | RowChange<MatchEvent>) => {
      const tid = dataRef.current.tournament?.id;
      const ishod =
        kljuc === 'matches'
          ? applyChange<Match>(dataRef.current.matches, promjena as RowChange<Match>, {
              belongs: (m) => !tid || m.tournament_id === tid,
              sort: (a, b) => a.sort_order - b.sort_order,
              required: ['id', 'tournament_id', 'sort_order', 'status', 'home_score', 'away_score'],
            })
          : applyChange<MatchEvent>(dataRef.current.events, promjena as RowChange<MatchEvent>, {
              sort: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
              required: ['id', 'match_id', 'created_at'],
            });

      if (ishod.kind === 'refetch') {
        void refreshMatchesEvents();
        return;
      }
      setData((d) =>
        kljuc === 'matches'
          ? { ...d, matches: ishod.rows as Match[] }
          : { ...d, events: ishod.rows as MatchEvent[] }
      );
    },
    [refreshMatchesEvents]
  );

  // ŽIVO: učitavanje + realtime na match/match_event.
  useEffect(() => {
    if (!LIVE || !supabase) return;
    const sb = supabase;

    // Red čekanja preživi gašenje app — učitaj ga prije nego išta drugo,
    // pa se neposlane akcije pošalju čim mreža proradi.
    void loadOutbox().then(() => reload());

    const ch = sb
      .channel('public-live')
      // Promjena se PRIMJENJUJE, ne dohvaća ponovno. Ranije je svaki gol
      // pokretao preuzimanje cijelog popisa utakmica i događaja — na kraju
      // turnira ~780 KB, i to na svakom spojenom telefonu, preko mobilnog
      // interneta gledatelja. Poruka koju Supabase ionako šalje nosi cijeli
      // redak, pa isti posao stane u ~300 bajta.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match' }, (p) =>
        primijeni('matches', p as RowChange<Match>)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_event' }, (p) =>
        primijeni('events', p as RowChange<MatchEvent>)
      )
      // Ekipe i dani se mijenjaju rijetko (odobrena prijava, dodan dan), ali
      // dotad se nova ekipa nije vidjela dok gledatelj ne povuce prstom.
      // Puno ucitavanje je ovdje jeftino jer se dogada nekoliko puta u turniru.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team' }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day' }, () => void reload())
      .subscribe();

    return () => {
      void sb.removeChannel(ch);
    };
  }, [reload, refreshMatchesEvents, primijeni]);

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
      loadError,
      reloading,
      reload,
      demo: !LIVE,
      ...data,
      teamById: (id) => (id ? teamIndex.get(id) : undefined),
      playersOf: (teamId) => players.filter((p) => p.team_id === teamId),
      matchById: (id) => matches.find((mm) => mm.id === id),
      eventsOf: (matchId) => events.filter((e) => e.match_id === matchId),

      startMatch: (id) => {
        const patch = { status: 'live' as const, current_half: 1, current_minute: 0 };
        patchMatchLocal(id, patch);
        if (LIVE && sb) enqueue({ kind: 'match.update', id, patch });
      },
      finishMatch: (id) => {
        patchMatchLocal(id, { status: 'finished' });
        if (!LIVE || !sb) return;
        enqueue({ kind: 'match.update', id, patch: { status: 'finished' } });

        // Obavijest je dosad slao samo web admin, pa utakmica zavrsena s
        // mobilnog nikoga nije obavijestila. Ide kroz red cekanja, iza upisa
        // statusa, da se posalje i kad je delegat u tom trenutku bez mreze.
        const m = matches.find((x) => x.id === id);
        const home = m?.home_team_id ? teamIndex.get(m.home_team_id) : null;
        const away = m?.away_team_id ? teamIndex.get(m.away_team_id) : null;
        if (m && home && away) {
          enqueue({
            kind: 'notify',
            id: newId(),
            tournament_id: m.tournament_id,
            type: 'match_end',
            audience: 'all',
            title: `${home.name} ${m.home_score}:${m.away_score} ${away.name}`,
            body: null,
            match_id: id,
          });
        }
      },
      setMinute: (id, minute) => {
        // Kozmetički tik (svake minute) — bez alarma da ne spamamo; greška se vidi na pravim akcijama.
        patchMatchLocal(id, { current_minute: minute });
        if (LIVE && sb) void sb.from('match').update({ current_minute: minute }).eq('id', id);
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
        // ID je isti lokalno i u bazi — ponovljeno slanje ne pravi duplikat,
        // a poništavanje zna koji red obrisati.
        if (LIVE && sb)
          enqueue({
            kind: 'event.insert',
            id: ev.id,
            match_id: matchId,
            team_id: teamId,
            player_id: playerId,
            type,
            minute,
            created_at: ev.created_at,
          });
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
        // ID događaja je isti lokalno i u bazi, pa brisanje ide kroz red
        // čekanja kao i sve ostalo. Ako još nije poslan, red ga samo izbaci.
        if (LIVE && sb) enqueue({ kind: 'event.delete', id: last.id });
      },
    };
  }, [data, loading, loadError, reloading, reload, notifyWriteError]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside <DataProvider>');
  return ctx;
}
