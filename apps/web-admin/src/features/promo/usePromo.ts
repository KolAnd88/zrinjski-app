import { useCallback, useEffect, useState } from 'react';
import type { Match } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import { fetchAllTeams, fetchFinishedMatches, fetchSponsors } from '../../lib/data';
import type { TeamLite } from '../schedule/useScheduleMatches';

export type PromoData = {
  loading: boolean;
  configured: boolean;
  matches: Match[];
  teamsById: Map<string, TeamLite>;
  goldSponsor: string | null;
};

export function usePromo(tournamentId: string | null): PromoData {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamsById, setTeamsById] = useState<Map<string, TeamLite>>(new Map());
  const [goldSponsor, setGoldSponsor] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [ms, teams, sponsors] = await Promise.all([
      fetchFinishedMatches(tournamentId),
      fetchAllTeams(tournamentId),
      fetchSponsors(tournamentId),
    ]);
    setMatches(ms);
    const map = new Map<string, TeamLite>();
    for (const tm of teams) map.set(tm.id, tm);
    setTeamsById(map);
    const gold = sponsors.find((s) => s.tier === 'gold' && s.is_active);
    setGoldSponsor(gold?.name ?? null);
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loading, configured: HAS_DATA, matches, teamsById, goldSponsor };
}
