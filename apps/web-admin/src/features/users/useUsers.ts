import { useCallback, useEffect, useState } from 'react';
import type { AppUser, Team } from '@zrinjski/core';
import { DEMO, HAS_DATA } from '../../lib/supabase';
import {
  adminCreateUser,
  adminDeleteUser,
  fetchActiveTournament,
  fetchAllTeams,
  fetchAppUsers,
  updateUserRole,
  type CreateUserInput,
} from '../../lib/data';

export type UsersData = {
  loading: boolean;
  demo: boolean;
  error: string | null;
  users: AppUser[];
  /** Ekipe — za vezanje predstavnika (uloga 'rep') uz njegovu ekipu. */
  teams: Team[];
  reload: () => Promise<void>;
  create: (input: CreateUserInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setRole: (id: string, role: string) => Promise<void>;
};

export function useUsers(): UsersData {
  const [loading, setLoading] = useState(HAS_DATA);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await fetchAppUsers());
      const t = await fetchActiveTournament();
      const ts = t ? await fetchAllTeams(t.id) : [];
      setTeams([...ts].sort((a, b) => a.name.localeCompare(b.name, 'hr')));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: CreateUserInput) => {
      await adminCreateUser(input);
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await adminDeleteUser(id);
      setUsers((us) => us.filter((u) => u.id !== id));
    },
    []
  );

  const setRole = useCallback(async (id: string, role: string) => {
    await updateUserRole(id, role);
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, role } : u)));
  }, []);

  return { loading, demo: DEMO, error, users, teams, reload, create, remove, setRole };
}
