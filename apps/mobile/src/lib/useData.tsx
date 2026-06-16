// useData.tsx — jedinstveni izvor podataka za app (korisnik + mobilni admin).
// Sada: demo podaci u stanju (mutabilno) → admin unos uživo odmah se vidi na
// korisničkim ekranima (simulira realtime). Kasnije (spajanje): isti oblik
// popunjava se iz Supabasea + realtime, bez promjene ekrana.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
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
import { isSupabaseConfigured } from './supabase';
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
  // Selektori
  teamById: (id: string | null | undefined) => Team | undefined;
  playersOf: (teamId: string) => Player[];
  matchById: (id: string) => Match | undefined;
  eventsOf: (matchId: string) => MatchEvent[];
  // Mutatori (mobilni admin / zapisničar)
  startMatch: (id: string) => void;
  finishMatch: (id: string) => void;
  adjustScore: (id: string, isHome: boolean, delta: number) => void;
  setMinute: (id: string, minute: number) => void;
  addEvent: (matchId: string, teamId: string, playerId: string | null, type: EventType, minute: number) => void;
  undoLastEvent: (matchId: string) => void;
};

const DataContext = createContext<DataStore | null>(null);

let evtSeq = 0;
function newId(): string {
  evtSeq += 1;
  return `evt-${Date.now()}-${evtSeq}`;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const demo = !isSupabaseConfigured;
  const [matches, setMatches] = useState<Match[]>(demoMatches);
  const [events, setEvents] = useState<MatchEvent[]>(demoEvents);

  const teams = demoTeams;
  const players = demoPlayers;

  const value = useMemo<DataStore>(() => {
    const teamIndex = new Map(teams.map((t) => [t.id, t] as const));

    const patchMatch = (id: string, patch: Partial<Match>) =>
      setMatches((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));

    return {
      loading: false,
      demo,
      tournament: demoTournament,
      days: demoDays,
      groups: demoGroups,
      teams,
      players,
      matches,
      events,
      sponsors: demoSponsors,
      locations: demoLocations,
      program: demoProgram,
      gallery: demoGallery,
      teamById: (id) => (id ? teamIndex.get(id) : undefined),
      playersOf: (teamId) => players.filter((p) => p.team_id === teamId),
      matchById: (id) => matches.find((mm) => mm.id === id),
      eventsOf: (matchId) => events.filter((e) => e.match_id === matchId),

      startMatch: (id) => patchMatch(id, { status: 'live', current_half: 1, current_minute: 0 }),
      finishMatch: (id) => patchMatch(id, { status: 'finished' }),
      setMinute: (id, minute) => patchMatch(id, { current_minute: minute }),
      adjustScore: (id, isHome, delta) =>
        setMatches((ms) =>
          ms.map((m) => {
            if (m.id !== id) return m;
            return isHome
              ? { ...m, home_score: Math.max(0, m.home_score + delta) }
              : { ...m, away_score: Math.max(0, m.away_score + delta) };
          })
        ),
      addEvent: (matchId, teamId, playerId, type, minute) => {
        const ev: MatchEvent = {
          id: newId(),
          match_id: matchId,
          team_id: teamId,
          player_id: playerId,
          type,
          minute,
          created_at: new Date().toISOString(),
        };
        setEvents((es) => [...es, ev]);
        // Gol → diže rezultat odgovarajuće ekipe (kao DB trigger).
        if (type === 'goal') {
          setMatches((ms) =>
            ms.map((m) => {
              if (m.id !== matchId) return m;
              const isHome = teamId === m.home_team_id;
              return {
                ...m,
                home_score: m.home_score + (isHome ? 1 : 0),
                away_score: m.away_score + (isHome ? 0 : 1),
              };
            })
          );
        }
      },
      undoLastEvent: (matchId) => {
        const matchEvents = events.filter((e) => e.match_id === matchId);
        const last = matchEvents[matchEvents.length - 1];
        if (!last) return;
        setEvents((es) => es.filter((e) => e.id !== last.id));
        if (last.type === 'goal') {
          setMatches((ms) =>
            ms.map((m) => {
              if (m.id !== matchId) return m;
              const isHome = last.team_id === m.home_team_id;
              return {
                ...m,
                home_score: Math.max(0, m.home_score - (isHome ? 1 : 0)),
                away_score: Math.max(0, m.away_score - (isHome ? 0 : 1)),
              };
            })
          );
        }
      },
    };
  }, [demo, matches, events, teams, players]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside <DataProvider>');
  return ctx;
}
