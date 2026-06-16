import { useCallback, useEffect, useState } from 'react';
import type { Match } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import { fetchAllTeams, fetchEnterableMatches } from '../../lib/data';
import type { TeamLite } from '../schedule/useScheduleMatches';

export function useEnterableMatches(tournamentId: string | null) {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, TeamLite>>(new Map());

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ms, teams] = await Promise.all([fetchEnterableMatches(tournamentId), fetchAllTeams(tournamentId)]);
    setMatches(ms);
    const map = new Map<string, TeamLite>();
    for (const tm of teams) map.set(tm.id, tm);
    setTeamsById(map);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, matches, teamsById, reload };
}
