import { useCallback, useEffect, useState } from 'react';
import type { Day, Grp, Match, Team, Tournament } from '@zrinjski/core';
import { generateSchedule, swapSlots, swappableNeighbour, type DayInput } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import {
  applyScheduledTimes,
  applySlotSwap,
  fetchAllTeams,
  fetchGroups,
  fetchMatchesForSchedule,
} from '../../lib/data';
import { toInputTime } from '../../lib/timeFormat';

export type TeamLite = {
  id: string;
  name: string;
  short_code: string | null;
  /** @deprecated boja se računa iz sort_order (crestColorFor) */
  color: string | null;
  /** Indeks za boju grba. */
  sort_order: number;
  logo_url: string | null;
};

export type ScheduleMatchesState = {
  loading: boolean;
  matches: Match[];
  teamsById: Map<string, TeamLite>;
  /** Pune ekipe i grupe — treba ih postavljanje zavrsnice. */
  teams: Team[];
  groups: Grp[];
  generating: boolean;
  reload: () => Promise<void>;
  /** Zamijeni termin sa susjednom utakmicom istog dana; odbija zaključane. */
  swap: (matchId: string, dir: 'up' | 'down') => Promise<void>;
  /** Generiraj satnicu iz dana + postavki; vrati broj raspoređenih utakmica. */
  generate: (tournament: Tournament, days: Day[]) => Promise<number>;
};

export function useScheduleMatches(tournamentId: string | null): ScheduleMatchesState {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, TeamLite>>(new Map());
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Grp[]>([]);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ms, allTeams, gm, gz] = await Promise.all([
      fetchMatchesForSchedule(tournamentId),
      fetchAllTeams(tournamentId),
      fetchGroups(tournamentId, 'm'),
      fetchGroups(tournamentId, 'z'),
    ]);
    setMatches(ms);
    setTeams(allTeams);
    setGroups([...gm, ...gz]);
    const teams = allTeams;
    const map = new Map<string, TeamLite>();
    for (const tm of teams) map.set(tm.id, tm);
    setTeamsById(map);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generate = useCallback(
    async (tournament: Tournament, days: Day[]): Promise<number> => {
      // Nakon početka turnira ponovno generiranje bi prepisalo stvarne termine
      // odigranih/tekućih utakmica i sva evidentirana kašnjenja.
      if (matches.some((match) => match.status !== 'scheduled')) return 0;
      setGenerating(true);
      try {
        // Grupiraj utakmice po danu, u redoslijedu igranja (matches su već sortirane po sort_order).
        const byDay = new Map<string, string[]>();
        for (const m of matches) {
          if (!m.day_id) continue;
          const arr = byDay.get(m.day_id) ?? [];
          arr.push(m.id);
          byDay.set(m.day_id, arr);
        }

        const dayInputs: DayInput[] = days.map((d) => ({
          dayId: d.id,
          date: d.date,
          firstMatchTime: toInputTime(d.first_match_time) || null,
          matchIds: byDay.get(d.id) ?? [],
        }));

        const scheduled = generateSchedule(dayInputs, {
          matchDurationMin: tournament.match_duration_min,
          gapMin: tournament.gap_min,
        });

        if (scheduled.length > 0) {
          await applyScheduledTimes(
            scheduled.map((s) => ({ id: s.matchId, scheduledTime: s.scheduledTime }))
          );
          // Lokalno odraz: upiši nova vremena.
          const timeById = new Map(scheduled.map((s) => [s.matchId, s.scheduledTime]));
          setMatches((prev) =>
            prev.map((m) =>
              timeById.has(m.id) ? { ...m, scheduled_time: timeById.get(m.id)! } : m
            )
          );
        }
        return scheduled.length;
      } finally {
        setGenerating(false);
      }
    },
    [matches]
  );

  /**
   * Zamijeni utakmicu sa susjednom istog dana — termin i mjesto u redu idu
   * zajedno. Namijenjeno situaciji "ekipa ne stiže u 10:20", gdje bi ponovno
   * generiranje satnice bilo pretjerano i obrisalo bi zabilježena kašnjenja.
   */
  const swap = useCallback(
    async (matchId: string, dir: 'up' | 'down') => {
      const me = matches.find((m) => m.id === matchId);
      // Vraća null i kad je zaključana sama utakmica i kad je zaključan susjed:
      // najavljena ne smije povući onu koja traje u svoj termin.
      const other = swappableNeighbour(matches, matchId, dir);
      if (!me || !other) return;

      const patches = swapSlots(me, other);
      await applySlotSwap(patches);

      const byId = new Map(patches.map((p) => [p.id, p]));
      setMatches((prev) =>
        [...prev.map((m) => (byId.has(m.id) ? { ...m, ...byId.get(m.id)! } : m))].sort(
          (a, b) => a.sort_order - b.sort_order
        )
      );
    },
    [matches]
  );

  return { loading, matches, teamsById, teams, groups, generating, reload, generate, swap };
}
