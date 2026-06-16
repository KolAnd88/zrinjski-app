// useData.tsx — jedinstveni izvor podataka za korisničku app.
// Sada: demo podaci (offline demo mod). Kasnije (Faza spajanja): isti oblik
// popunjava se iz Supabasea + realtime, bez promjene ekrana.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  Day,
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
  /** true = prikazujemo demo podatke (Supabase još nije spojen). */
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
};

const DataContext = createContext<DataStore | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const value = useMemo<DataStore>(() => {
    // TODO (spajanje): kad je isSupabaseConfigured, dohvati iz Supabasea + realtime.
    const demo = !isSupabaseConfigured;

    const teams = demoTeams;
    const players = demoPlayers;
    const matches = demoMatches;
    const events = demoEvents;

    const teamIndex = new Map(teams.map((t) => [t.id, t] as const));

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
    };
  }, []);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside <DataProvider>');
  return ctx;
}
