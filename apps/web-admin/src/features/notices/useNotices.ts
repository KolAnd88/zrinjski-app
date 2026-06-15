import { useCallback, useEffect, useState } from 'react';
import type { NotificationLog, Team } from '@zrinjski/core';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { fetchNotifications, insertNotification } from '../../lib/data';

export type NoticesData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  notifications: NotificationLog[];
  teams: Team[];
  send: (tournamentId: string, audience: string, title: string, body: string) => Promise<void>;
};

export function useNotices(tournamentId: string | null): NoticesData {
  const [loading, setLoading] = useState(isSupabaseConfigured && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const reload = useCallback(async () => {
    if (!supabase || !tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [notes, teamsRes] = await Promise.all([
        fetchNotifications(tournamentId),
        supabase.from('team').select('*').eq('tournament_id', tournamentId).order('name'),
      ]);
      setNotifications(notes);
      setTeams((teamsRes.data ?? []) as Team[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const send = useCallback(
    async (tId: string, audience: string, title: string, body: string) => {
      // Zapis u log; stvarni push šalje servis u Fazi 5 (Expo Notifications).
      const created = await insertNotification({
        tournament_id: tId,
        type: 'custom',
        audience,
        title: title.trim(),
        body: body.trim() || null,
      });
      setNotifications((xs) => [created, ...xs]);
    },
    []
  );

  return {
    loading,
    configured: isSupabaseConfigured,
    error,
    notifications,
    teams,
    send,
  };
}
