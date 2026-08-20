import { useEffect, useState } from 'react';
import type { Stage } from '@zrinjski/core';
import { HAS_DATA } from '../lib/supabase';
import {
  fetchActiveTournament,
  fetchAllTeams,
  fetchMatchesForSchedule,
  fetchRegistrations,
  fetchSponsors,
  fetchTeam,
} from '../lib/data';

export type LiveMatch = {
  id: string;
  stage: Stage;
  homeName: string;
  homeCode: string | null;
  homeIndex: number;
  awayName: string;
  awayCode: string | null;
  awayIndex: number;
  homeScore: number;
  awayScore: number;
};

export type DashboardData = {
  loading: boolean;
  configured: boolean;
  error: boolean;
  live: LiveMatch | null;
  counts: { teams: number; teamsM: number; teamsZ: number; played: number; total: number; sponsors: number };
  todo: { pendingRegistrations: number; finishedNoBestPlayer: number };
};

const EMPTY: Omit<DashboardData, 'loading' | 'configured' | 'error'> = {
  live: null,
  counts: { teams: 0, teamsM: 0, teamsZ: 0, played: 0, total: 0, sponsors: 0 },
  todo: { pendingRegistrations: 0, finishedNoBestPlayer: 0 },
};

export function useDashboard(): DashboardData {
  const [state, setState] = useState<DashboardData>({
    loading: HAS_DATA,
    configured: HAS_DATA,
    error: false,
    ...EMPTY,
  });

  useEffect(() => {
    if (!HAS_DATA) return;
    let active = true;

    (async () => {
      try {
        const t = await fetchActiveTournament();
        if (!t) {
          if (active) setState((s) => ({ ...s, loading: false }));
          return;
        }
        const [teams, matches, sponsors, regs] = await Promise.all([
          fetchAllTeams(t.id),
          fetchMatchesForSchedule(t.id),
          fetchSponsors(t.id),
          fetchRegistrations(t.id),
        ]);

        const played = matches.filter((m) => m.status === 'finished').length;
        const finishedNoBestPlayer = matches.filter((m) => m.status === 'finished' && !m.best_player_id).length;

        const lm = matches.find((m) => m.status === 'live') ?? null;
        let live: LiveMatch | null = null;
        if (lm) {
          const [home, away] = await Promise.all([
            lm.home_team_id ? fetchTeam(lm.home_team_id) : Promise.resolve(null),
            lm.away_team_id ? fetchTeam(lm.away_team_id) : Promise.resolve(null),
          ]);
          live = {
            id: lm.id,
            stage: lm.stage,
            homeName: home?.name ?? '—',
            homeCode: home?.short_code ?? null,
            homeIndex: home?.sort_order ?? 0,
            awayName: away?.name ?? '—',
            awayCode: away?.short_code ?? null,
            awayIndex: away?.sort_order ?? 0,
            homeScore: lm.home_score,
            awayScore: lm.away_score,
          };
        }

        if (!active) return;
        setState({
          loading: false,
          configured: true,
          error: false,
          live,
          counts: {
            teams: teams.length,
            teamsM: teams.filter((tm) => tm.gender === 'm').length,
            teamsZ: teams.filter((tm) => tm.gender === 'z').length,
            played,
            total: matches.length,
            sponsors: sponsors.length,
          },
          todo: {
            pendingRegistrations: regs.filter((r) => r.status === 'pending').length,
            finishedNoBestPlayer,
          },
        });
      } catch {
        if (active) setState((s) => ({ ...s, loading: false, error: true }));
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return state;
}
