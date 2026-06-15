import { useCallback, useEffect, useState } from 'react';
import type { Registration } from '@zrinjski/core';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  createTeam,
  fetchRegistrations,
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
  const [loading, setLoading] = useState(isSupabaseConfigured && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Registration[]>([]);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured || !tournamentId) {
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
      await createTeam({
        tournament_id: tournamentId,
        name: reg.team_name,
        gender: reg.gender,
        rep_email: reg.rep_email,
        short_code: autoShortCode(reg.team_name),
      });
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
    configured: isSupabaseConfigured,
    error,
    pending: items.filter((r) => r.status === 'pending'),
    approved: items.filter((r) => r.status === 'approved'),
    approve,
    reject,
  };
}
