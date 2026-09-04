import { useCallback, useEffect, useState } from 'react';
import type { Registration, RegistrationPlayer } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import {
  approveRegistration,
  fetchRegistrations,
  rejectRegistration,
  updateRegistrationPlayers,
  waitlistToPending,
} from '../../lib/data';
import { autoShortCode } from '../../lib/crest';

export type RegistrationsData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  pending: Registration[];
  approved: Registration[];
  /** Prijave stigle kad je konkurencija bila puna, redom kojim su stigle. */
  waitlist: Registration[];
  processingId: string | null;
  /** Odobri prijavu atomski: ekipa + igrači + status u jednoj transakciji. */
  approve: (reg: Registration) => Promise<void>;
  reject: (id: string) => Promise<void>;
  /** S liste čekanja u red za odluku. Odobrenje ostaje zaseban, svjestan korak. */
  promote: (id: string) => Promise<void>;
  /** Promijeni sastav u prijavi koja jos ceka odobrenje. */
  saveRoster: (id: string, players: RegistrationPlayer[]) => Promise<void>;
};

export function useRegistrations(tournamentId: string | null): RegistrationsData {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Registration[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
      setProcessingId(reg.id);
      setError(null);
      try {
        const teamId = await approveRegistration(reg.id, autoShortCode(reg.team_name));
        setItems((xs) =>
          xs.map((r) =>
            r.id === reg.id
              ? {
                  ...r,
                  status: 'approved',
                  approved_team_id: teamId,
                  processed_at: new Date().toISOString(),
                }
              : r
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setProcessingId(null);
      }
    },
    [tournamentId]
  );

  const reject = useCallback(async (id: string) => {
    setProcessingId(id);
    setError(null);
    try {
      await rejectRegistration(id);
      setItems((xs) =>
        xs.map((r) =>
          r.id === id ? { ...r, status: 'rejected', processed_at: new Date().toISOString() } : r
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingId(null);
    }
  }, []);

  const promote = useCallback(async (id: string) => {
    setProcessingId(id);
    setError(null);
    try {
      await waitlistToPending(id);
      setItems((xs) => xs.map((r) => (r.id === id ? { ...r, status: 'pending' } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessingId(null);
    }
  }, []);

  const saveRoster = useCallback(async (id: string, players: RegistrationPlayer[]) => {
    await updateRegistrationPlayers(id, players);
    setItems((xs) =>
      xs.map((r) => (r.id === id ? { ...r, players, player_count: players.length } : r))
    );
  }, []);

  return {
    loading,
    configured: HAS_DATA,
    error,
    pending: items.filter((r) => r.status === 'pending'),
    approved: items.filter((r) => r.status === 'approved'),
    // Red je bitan: tko je prije stigao, prvi je na redu kad se mjesto oslobodi.
    waitlist: items
      .filter((r) => r.status === 'waitlist')
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    processingId,
    approve,
    reject,
    promote,
    saveRoster,
  };
}
