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
import { isoToLocalHHMM } from '../lib/timeFormat';

/** Vrijeme za sortiranje — Date, ne usporedba stringova (vidi bilješku o UTC-u). */
const ts = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

export type LiveMatch = {
  id: string;
  stage: Stage;
  homeName: string;
  homeCode: string | null;
  homeIndex: number;
  homeLogo: string | null;
  awayName: string;
  awayCode: string | null;
  awayIndex: number;
  awayLogo: string | null;
  homeScore: number;
  awayScore: number;
};

export type DashboardData = {
  loading: boolean;
  configured: boolean;
  error: boolean;
  live: LiveMatch | null;
  counts: { teams: number; teamsM: number; teamsZ: number; played: number; total: number; sponsors: number };
  todo: { pendingRegistrations: number; missingMvp: number };
  /** Sljedeće najavljene utakmice — 'Sljedeće u dvorani' na nadzornoj ploči. */
  queue: { id: string; time: string; label: string; stage: Stage }[];
};

const EMPTY: Omit<DashboardData, 'loading' | 'configured' | 'error'> = {
  live: null,
  counts: { teams: 0, teamsM: 0, teamsZ: 0, played: 0, total: 0, sponsors: 0 },
  todo: { pendingRegistrations: 0, missingMvp: 0 },
  queue: [],
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
        // Koliko konkurencija još nema najboljeg igrača. Broje se samo one
        // koje uopće postoje — turnir bez ženskih ekipa nema što tamo birati.
        const missingMvp =
          (teams.some((x) => x.gender === 'm') && !t.mvp_m_player_id ? 1 : 0) +
          (teams.some((x) => x.gender === 'z') && !t.mvp_z_player_id ? 1 : 0);

        // Ekipa je poznata za grupne utakmice; u završnici stoji placeholder
        // ("Pobjednik PF1") dok se ne odigra polufinale.
        const nameOf = (teamId: string | null, placeholder: string | null) =>
          teams.find((x) => x.id === teamId)?.name ?? placeholder ?? '—';

        const queue = matches
          .filter((m) => m.status === 'scheduled' && m.scheduled_time)
          .sort((a, b) => ts(a.scheduled_time) - ts(b.scheduled_time))
          .slice(0, 4)
          .map((m) => ({
            id: m.id,
            time: isoToLocalHHMM(m.scheduled_time),
            label: `${nameOf(m.home_team_id, m.home_placeholder)} – ${nameOf(m.away_team_id, m.away_placeholder)}`,
            stage: m.stage,
          }));

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
            homeLogo: home?.logo_url ?? null,
            awayName: away?.name ?? '—',
            awayCode: away?.short_code ?? null,
            awayIndex: away?.sort_order ?? 0,
            awayLogo: away?.logo_url ?? null,
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
            missingMvp,
          },
          queue,
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
