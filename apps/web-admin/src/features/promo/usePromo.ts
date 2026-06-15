import { useCallback, useEffect, useState } from 'react';
import type { Match } from '@zrinjski/core';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { fetchFinishedMatches } from '../../lib/data';
import type { TeamLite } from '../schedule/useScheduleMatches';

export type PromoData = {
  loading: boolean;
  configured: boolean;
  matches: Match[];
  teamsById: Map<string, TeamLite>;
  goldSponsor: string | null;
};

export function usePromo(tournamentId: string | null): PromoData {
  const [loading, setLoading] = useState(isSupabaseConfigured && !!tournamentId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, TeamLite>>(new Map());
  const [goldSponsor, setGoldSponsor] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!supabase || !tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ms, teamsRes, goldRes] = await Promise.all([
      fetchFinishedMatches(tournamentId),
      supabase.from('team').select('id, name, short_code, color').eq('tournament_id', tournamentId),
      supabase
        .from('sponsor')
        .select('name')
        .eq('tournament_id', tournamentId)
        .eq('tier', 'gold')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
    ]);
    setMatches(ms);
    const map = new Map<string, TeamLite>();
    for (const tm of (teamsRes.data ?? []) as TeamLite[]) map.set(tm.id, tm);
    setTeamsById(map);
    setGoldSponsor(goldRes.data?.name ?? null);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, configured: isSupabaseConfigured, matches, teamsById, goldSponsor };
}
