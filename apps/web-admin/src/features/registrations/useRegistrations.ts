import { useCallback, useEffect, useState } from 'react';
import type { Registration } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import {
  createPlayer,
  createTeam,
  fetchRegistrations,
  fetchTeams,
  updateRegistrationStatus,
} from '../../lib/data';
import { autoShortCode } from '../../lib/crest';

export type RegistrationsData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  pending: Registration[];
  approved: Registration[];
  /** Odobri prijavu: status → approved + kreiraj ekipu (vidljiva u Ekipama). */
  approve: (reg: Registration) => Promise<void>;
  reject: (id: string) => Promise<void>;
};

export function useRegistrations(tournamentId: string | null): RegistrationsData {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Registration[]>([]);

  const reload = useCallback(async () => {
    if (!HAS_DATA || !tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchRegistrations(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const approve = useCallback(
    async (reg: Registration) => {
      if (!tournamentId) return;
      // Nova ekipa ide na kraj popisa svog spola → dobiva sljedeću boju grba.
      const existing = await fetchTeams(tournamentId, reg.gender);
      const team = await createTeam({
        tournament_id: tournamentId,
        name: reg.team_name,
        gender: reg.gender,
        rep_email: reg.rep_email,
        short_code: autoShortCode(reg.team_name),
        sort_order: existing.length,
      });

      // Prijavljeni sastav (ako ga ima) prepiši u igrače ekipe.
      const roster = reg.players ?? [];
      for (let i = 0; i < roster.length; i++) {
        const p = roster[i]!;
        if (!p.name?.trim()) continue;
        await createPlayer({
          team_id: team.id,
          name: p.name.trim(),
          number: p.number ?? null,
          sort_order: i,
        });
      }

      await updateRegistrationStatus(reg.id, 'approved');
      setItems((xs) => xs.map((r) => (r.id === reg.id ? { ...r, status: 'approved' } : r)));
    },
    [tournamentId]
  );

  const reject = useCallback(async (id: string) => {
    await updateRegistrationStatus(id, 'rejected');
    setItems((xs) => xs.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)));
  }, []);

  return {
    loading,
    configured: HAS_DATA,
    error,
    pending: items.filter((r) => r.status === 'pending'),
    approved: items.filter((r) => r.status === 'approved'),
    approve,
    reject,
  };
}
