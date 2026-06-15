import { useCallback, useEffect, useState } from 'react';
import type { Day, Tournament, TablesUpdate } from '@zrinjski/core';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  createDay,
  deleteDay,
  fetchActiveTournament,
  fetchDays,
  updateDay,
  updateTournament,
} from '../../lib/data';

export type TournamentData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  tournament: Tournament | null;
  days: Day[];
  reload: () => Promise<void>;
  saveSettings: (patch: TablesUpdate<'tournament'>) => Promise<void>;
  addDay: (date: string) => Promise<void>;
  editDay: (id: string, patch: TablesUpdate<'day'>) => Promise<void>;
  removeDay: (id: string) => Promise<void>;
};

export function useTournamentData(): TournamentData {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [days, setDays] = useState<Day[]>([]);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const t = await fetchActiveTournament();
      setTournament(t);
      setDays(t ? await fetchDays(t.id) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveSettings = useCallback(
    async (patch: TablesUpdate<'tournament'>) => {
      if (!tournament) return;
      await updateTournament(tournament.id, patch);
      setTournament((t) => (t ? { ...t, ...patch } : t));
    },
    [tournament]
  );

  const addDay = useCallback(
    async (date: string) => {
      if (!tournament) return;
      const nextOrder = days.length;
      const created = await createDay(tournament.id, date, nextOrder);
      setDays((d) => [...d, created]);
    },
    [tournament, days.length]
  );

  const editDay = useCallback(async (id: string, patch: TablesUpdate<'day'>) => {
    await updateDay(id, patch);
    setDays((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const removeDay = useCallback(async (id: string) => {
    await deleteDay(id);
    setDays((d) => d.filter((x) => x.id !== id));
  }, []);

  return {
    loading,
    configured: isSupabaseConfigured,
    error,
    tournament,
    days,
    reload,
    saveSettings,
    addDay,
    editDay,
    removeDay,
  };
}
