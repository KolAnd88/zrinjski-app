import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventType, Match, MatchEvent, Player } from '@zrinjski/core';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  deleteEvent,
  fetchEvents,
  fetchMatch,
  fetchPlayersByTeams,
  insertEvent,
  updateMatch,
} from '../../lib/data';

export type LiveTeam = {
  id: string;
  name: string;
  short_code: string | null;
  color: string | null;
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
  adjustScore: (sideIsHome: boolean, delta: number) => Promise<void>;
  addEvent: (teamId: string, playerId: string | null, type: EventType, minute: number) => Promise<void>;
  undoLast: () => Promise<void>;
  persistMinute: (minute: number) => Promise<void>;
};

async function loadTeam(id: string | null, players: Player[]): Promise<LiveTeam | null> {
  if (!id || !supabase) return null;
  const { data } = await supabase.from('team').select('id, name, short_code, color').eq('id', id).single();
  if (!data) return null;
  return { ...data, players: players.filter((p) => p.team_id === id) };
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
  const [loading, setLoading] = useState(isSupabaseConfigured && !!matchId);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [home, setHome] = useState<LiveTeam | null>(null);
  const [away, setAway] = useState<LiveTeam | null>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const matchRef = useRef<Match | null>(null);
  matchRef.current = match;

  const reload = useCallback(async () => {
    if (!supabase || !matchId) {
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
        () => {
          void fetchEvents(matchId).then(setEvents);
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
  }, [match]);

  const adjustScore = useCallback(
    async (sideIsHome: boolean, delta: number) => {
      const m = matchRef.current;
      if (!m) return;
      const next = sideIsHome
        ? { home_score: Math.max(0, m.home_score + delta) }
        : { away_score: Math.max(0, m.away_score + delta) };
      await updateMatch(m.id, next);
      setMatch((cur) => (cur ? { ...cur, ...next } : cur));
    },
    []
  );

  const addEvent = useCallback(
    async (teamId: string, playerId: string | null, type: EventType, minute: number) => {
      const m = matchRef.current;
      if (!m) return;
      const ev = await insertEvent({ match_id: m.id, team_id: teamId, player_id: playerId, type, minute });
      setEvents((prev) => [...prev, ev]);
      // Gol → DB trigger podiže rezultat; lokalno optimistično odrazimo.
      if (type === 'goal') {
        const isHome = teamId === m.home_team_id;
        setMatch((cur) =>
          cur
            ? {
                ...cur,
                home_score: cur.home_score + (isHome ? 1 : 0),
                away_score: cur.away_score + (isHome ? 0 : 1),
              }
            : cur
        );
      }
    },
    []
  );

  const undoLast = useCallback(async () => {
    const last = events[events.length - 1];
    const m = matchRef.current;
    if (!last || !m) return;
    await deleteEvent(last.id);
    setEvents((prev) => prev.slice(0, -1));
    if (last.type === 'goal') {
      const isHome = last.team_id === m.home_team_id;
      setMatch((cur) =>
        cur
          ? {
              ...cur,
              home_score: Math.max(0, cur.home_score - (isHome ? 1 : 0)),
              away_score: Math.max(0, cur.away_score - (isHome ? 0 : 1)),
            }
          : cur
      );
    }
  }, [events]);

  const persistMinute = useCallback(async (minute: number) => {
    const m = matchRef.current;
    if (!m || m.status !== 'live' || m.current_minute === minute) return;
    await updateMatch(m.id, { current_minute: minute });
    setMatch((cur) => (cur ? { ...cur, current_minute: minute } : cur));
  }, []);

  const feed = buildFeed(events, match?.home_team_id ?? null, match?.away_team_id ?? null);

  return {
    loading,
    configured: isSupabaseConfigured,
    error,
    match,
    home,
    away,
    events,
    feed,
    start,
    finish,
    adjustScore,
    addEvent,
    undoLast,
    persistMinute,
  };
}
