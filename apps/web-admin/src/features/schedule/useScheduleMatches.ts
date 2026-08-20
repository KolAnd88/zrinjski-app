import { useCallback, useEffect, useState } from 'react';
import type { Day, Match, Tournament } from '@zrinjski/core';
import { generateSchedule, type DayInput } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import { applyScheduledTimes, fetchAllTeams, fetchMatchesForSchedule } from '../../lib/data';
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
  generating: boolean;
  reload: () => Promise<void>;
  /** Generiraj satnicu iz dana + postavki; vrati broj raspoređenih utakmica. */
  generate: (tournament: Tournament, days: Day[]) => Promise<number>;
};

export function useScheduleMatches(tournamentId: string | null): ScheduleMatchesState {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, TeamLite>>(new Map());
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ms, teams] = await Promise.all([fetchMatchesForSchedule(tournamentId), fetchAllTeams(tournamentId)]);
    setMatches(ms);
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

  return { loading, matches, teamsById, generating, reload, generate };
}
