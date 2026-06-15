import { useEffect, useState } from 'react';
import type { Gender, MatchStatus, Stage } from '@zrinjski/core';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type LiveMatch = {
  id: string;
  stage: Stage;
  homeName: string;
  homeCode: string | null;
  homeColor: string | null;
  awayName: string;
  awayCode: string | null;
  awayColor: string | null;
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

async function fetchTeamLite(id: string | null) {
  if (!id || !supabase) return null;
  const { data } = await supabase.from('team').select('name, short_code, color').eq('id', id).single();
  return data;
}

export function useDashboard(): DashboardData {
  const [state, setState] = useState<DashboardData>({
    loading: isSupabaseConfigured,
    configured: isSupabaseConfigured,
    error: false,
    ...EMPTY,
  });

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      try {
        const [teamsRes, matchesRes, sponsorsRes, liveRes, regRes] = await Promise.all([
          supabase.from('team').select('gender'),
          supabase.from('match').select('status, best_player_id'),
          supabase.from('sponsor').select('id', { count: 'exact', head: true }),
          supabase
            .from('match')
            .select('id, stage, home_team_id, away_team_id, home_score, away_score')
            .eq('status', 'live' satisfies MatchStatus)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('registration')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);

        const teams = (teamsRes.data ?? []) as { gender: Gender }[];
        const matches = (matchesRes.data ?? []) as { status: MatchStatus; best_player_id: string | null }[];
        const played = matches.filter((m) => m.status === 'finished').length;
        const finishedNoBestPlayer = matches.filter(
          (m) => m.status === 'finished' && !m.best_player_id
        ).length;

        let live: LiveMatch | null = null;
        if (liveRes.data) {
          const lm = liveRes.data;
          const [home, away] = await Promise.all([
            fetchTeamLite(lm.home_team_id),
            fetchTeamLite(lm.away_team_id),
          ]);
          live = {
            id: lm.id,
            stage: lm.stage,
            homeName: home?.name ?? '—',
            homeCode: home?.short_code ?? null,
            homeColor: home?.color ?? null,
            awayName: away?.name ?? '—',
            awayCode: away?.short_code ?? null,
            awayColor: away?.color ?? null,
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
            teamsM: teams.filter((t) => t.gender === 'm').length,
            teamsZ: teams.filter((t) => t.gender === 'z').length,
            played,
            total: matches.length,
            sponsors: sponsorsRes.count ?? 0,
          },
          todo: {
            pendingRegistrations: regRes.count ?? 0,
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
