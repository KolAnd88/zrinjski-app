import { useCallback, useEffect, useState } from 'react';
import type { NotificationLog, Team } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import {
  fetchAllTeams,
  fetchNotifications,
  insertNotification,
  processPushReceipts,
  sendPush,
  type PushResult,
} from '../../lib/data';

export type NoticesData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  notifications: NotificationLog[];
  teams: Team[];
  /** Broj uređaja kojima je zadnja obavijest stvarno isporučena; null prije slanja. */
  sentResult: PushResult | null;
  send: (tournamentId: string, audience: string, title: string, body: string) => Promise<void>;
};

export function useNotices(tournamentId: string | null): NoticesData {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sentResult, setSentResult] = useState<PushResult | null>(null);

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [notes, ts] = await Promise.all([
        fetchNotifications(tournamentId),
        fetchAllTeams(tournamentId),
      ]);
      setNotifications(notes);
      setTeams([...ts].sort((a, b) => a.name.localeCompare(b.name, 'hr')));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Usput obradi Expo potvrde isporuke. Bez ovoga se obrađuju tek pri sljedećem
  // slanju, pa zadnja poslana obavijest ostaje neprovjerena — a Expo potvrde
  // briše nakon 24 sata.
  useEffect(() => {
    void processPushReceipts();
  }, []);

  const send = useCallback(
    async (tId: string, audience: string, title: string, body: string) => {
      const created = await insertNotification({
        tournament_id: tId,
        type: 'custom',
        audience,
        title: title.trim(),
        body: body.trim() || null,
      });
      setNotifications((xs) => [created, ...xs]);
      // Log je zapisan; sad stvarno slanje. Ako padne, obavijest ostaje u
      // povijesti i korisnik vidi grešku — ne gubimo trag da je pokušano.
      setSentResult(await sendPush({ audience, title: title.trim(), body: body.trim() || null, type: 'custom' }));
    },
    []
  );

  return {
    loading,
    configured: HAS_DATA,
    error,
    notifications,
    teams,
    sentResult,
    send,
  };
}
