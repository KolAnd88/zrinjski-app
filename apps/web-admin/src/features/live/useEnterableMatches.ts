import { useCallback, useEffect, useState } from 'react';
import type { Match } from '@zrinjski/core';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { fetchEnterableMatches } from '../../lib/data';
import type { TeamLite } from '../schedule/useScheduleMatches';

export function useEnterableMatches(tournamentId: string | null) {
  const [loading, setLoading] = useState(isSupabaseConfigured && !!tournamentId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, TeamLite>>(new Map());

  const reload = useCallback(async () => {
    if (!supabase || !tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ms, teamsRes] = await Promise.all([
      fetchEnterableMatches(tournamentId),
      supabase.from('team').select('id, name, short_code, color').eq('tournament_id', tournamentId),
    ]);
    setMatches(ms);
    const map = new Map<string, TeamLite>();
    for (const tm of (teamsRes.data ?? []) as TeamLite[]) map.set(tm.id, tm);
    setTeamsById(map);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, matches, teamsById, reload };
}
