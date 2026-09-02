import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventType, Match, MatchEvent, Player } from '@zrinjski/core';
import { applyChange, type RowChange } from '@zrinjski/core';
import { HAS_DATA, supabase } from '../../lib/supabase';
import {
  deleteEvent,
  fetchEvents,
  fetchMatch,
  fetchPlayersByTeams,
  fetchTeam,
  insertEvent,
  updateMatch,
  notifyQuietly,
} from '../../lib/data';

export type LiveTeam = {
  id: string;
  name: string;
  short_code: string | null;
  /** Indeks za boju grba (crestColorFor). */
  sort_order: number;
  logo_url: string | null;
  players: Player[];
};

export type FeedEntry = {
  event: MatchEvent;
  homeScore: number;
  awayScore: number;
};

export type LiveMatchState = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  match: Match | null;
  home: LiveTeam | null;
  away: LiveTeam | null;
  events: MatchEvent[];
  feed: FeedEntry[];
  start: () => Promise<void>;
  finish: () => Promise<void>;
  addEvent: (teamId: string, playerId: string | null, type: EventType, minute: number) => Promise<void>;
  undoLast: () => Promise<void>;
  persistMinute: (minute: number) => Promise<void>;
  /** Postavi ili ukloni najboljeg igrača utakmice. */
  setBestPlayer: (playerId: string | null) => Promise<void>;
};

async function loadTeam(id: string | null, players: Player[]): Promise<LiveTeam | null> {
  if (!id) return null;
  const data = await fetchTeam(id);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    short_code: data.short_code,
    sort_order: data.sort_order,
    logo_url: data.logo_url,
    players: players.filter((p) => p.team_id === id),
  };
}

/** Tijek s tekućim rezultatom (golovi se zbrajaju kronološki). */
function buildFeed(events: MatchEvent[], homeId: string | null, awayId: string | null): FeedEntry[] {
  let h = 0;
  let a = 0;
  const out: FeedEntry[] = [];
  for (const e of events) {
    if (e.type === 'goal') {
      if (e.team_id === homeId) h++;
      else if (e.team_id === awayId) a++;
    }
    out.push({ event: e, homeScore: h, awayScore: a });
  }
  return out;
}

export function useLiveMatch(matchId: string | null): LiveMatchState {
  const [loading, setLoading] = useState(HAS_DATA && !!matchId);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [home, setHome] = useState<LiveTeam | null>(null);
  const [away, setAway] = useState<LiveTeam | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;

  const reload = useCallback(async () => {
    if (!matchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const m = await fetchMatch(matchId);
      setMatch(m);
      if (m) {
        const ids = [m.home_team_id, m.away_team_id].filter((x): x is string => !!x);
        const players = await fetchPlayersByTeams(ids);
        const [h, a] = await Promise.all([
          loadTeam(m.home_team_id, players),
          loadTeam(m.away_team_id, players),
        ]);
        setHome(h);
        setAway(a);
        setEvents(await fetchEvents(m.id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Realtime: promjene rezultata i događaja stižu odmah (i na ovaj ekran i na TV/korisnike).
  useEffect(() => {
    const sb = supabase;
    if (!sb || !matchId) return;
    const ch = sb
      .channel(`live:${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match', filter: `id=eq.${matchId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setMatch((prev) => ({ ...(prev as Match), ...(payload.new as Match) }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_event', filter: `match_id=eq.${matchId}` },
        (payload) => {
          // Promjena se primjenjuje umjesto ponovnog dohvaćanja — zapisničaru
          // gol tako uđe bez odlaska na poslužitelj. Ako se ne može pouzdano
          // primijeniti, povlači se puni popis te utakmice.
          setEvents((prev) => {
            const r = applyChange<MatchEvent>(prev, payload as RowChange<MatchEvent>, {
              sort: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
              required: ['id', 'match_id', 'created_at'],
            });
            if (r.kind === 'refetch') {
              void fetchEvents(matchId).then(setEvents);
              return prev;
            }
            return r.rows;
          });
        }
      )
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [matchId]);

  const start = useCallback(async () => {
    if (!match) return;
    await updateMatch(match.id, { status: 'live', current_half: 1, current_minute: 0 });
    setMatch((m) => (m ? { ...m, status: 'live', current_half: 1, current_minute: 0 } : m));
  }, [match]);

  const finish = useCallback(async () => {
    if (!match) return;
    await updateMatch(match.id, { status: 'finished' });
    setMatch((m) => (m ? { ...m, status: 'finished' } : m));

    // Obavijest ide TEK nakon što je završetak zapisan, i to bez čekanja:
    // zapisničar ne smije stajati zbog pusha. Naslov nosi konačan rezultat,
    // jer se obavijest često pročita bez otvaranja aplikacije.
    if (home && away) {
      notifyQuietly({
        tournament_id: match.tournament_id,
        type: 'match_end',
        audience: 'all',
        title: `${home.name} ${match.home_score}:${match.away_score} ${away.name}`,
        body: null,
      });
    }
  }, [match, home, away]);

  const addEvent = useCallback(
    async (teamId: string, playerId: string | null, type: EventType, minute: number) => {
      const m = matchRef.current;
      if (!m) return;
      const ev = await insertEvent({ match_id: m.id, team_id: teamId, player_id: playerId, type, minute });
      // Realtime može stići prije odgovora na INSERT. Spajanje po ID-u sprječava
      // da isti događaj nakratko bude prikazan dvaput.
      setEvents((prev) => (prev.some((item) => item.id === ev.id) ? prev : [...prev, ev]));
      // Gol podiže DB trigger. Učitaj autoritativni rezultat umjesto lokalnog
      // +1, jer bi Realtime UPDATE i optimistični +1 u utrci mogli dati dupli gol.
      if (type === 'goal') {
        try {
          const fresh = await fetchMatch(m.id);
          if (fresh) setMatch(fresh);
        } catch {
          // Realtime će svejedno donijeti rezultat; događaj je već sigurno upisan.
        }
      }
    },
    []
  );

  const undoLast = useCallback(async () => {
    const last = events[events.length - 1];
    const m = matchRef.current;
    if (!last || !m) return;
    await deleteEvent(last.id);
    // Filter po ID-u je siguran i ako je Realtime već osvježio popis.
    setEvents((prev) => prev.filter((item) => item.id !== last.id));
    if (last.type === 'goal') {
      try {
        const fresh = await fetchMatch(m.id);
        if (fresh) setMatch(fresh);
      } catch {
        // Realtime će donijeti kanonski rezultat kad se veza oporavi.
      }
    }
  }, [events]);

  const persistMinute = useCallback(async (minute: number) => {
    const m = matchRef.current;
    if (!m || m.status !== 'live' || m.current_minute === minute) return;
    await updateMatch(m.id, { current_minute: minute });
    setMatch((cur) => (cur ? { ...cur, current_minute: minute } : cur));
  }, []);

  const feed = buildFeed(events, match?.home_team_id ?? null, match?.away_team_id ?? null);

  /** Najbolji igrač utakmice — bira se tek kad je utakmica gotova. */
  const setBestPlayer = useCallback(
    async (playerId: string | null) => {
      if (!match) return;
      await updateMatch(match.id, { best_player_id: playerId });
      setMatch((m) => (m ? { ...m, best_player_id: playerId } : m));
    },
    [match]
  );

  return {
    loading,
    configured: HAS_DATA,
    error,
    match,
    home,
    away,
    events,
    feed,
    start,
    finish,
    addEvent,
    undoLast,
    persistMinute,
    setBestPlayer,
  };
}
