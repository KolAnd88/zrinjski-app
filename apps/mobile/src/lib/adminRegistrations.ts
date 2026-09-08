// adminRegistrations.ts — prijave koje čekaju odluku, za organizatora na terenu.
//
// Odvojeno od `useData` iz istog razloga kao repData: useData drži cijeli
// turnir u memoriji za gledatelje, a ovo je mali skup koji zanima samo
// organizatora i mijenja se rijetko. Nema smisla nositi ga svima.
//
// RLS jamči da ovo vidi samo organizacija — anonimni ključ na `registration`
// vraća prazno, bez obzira što se ovdje traži.
import { useCallback, useEffect, useState } from 'react';
import type { Gender, RegistrationPlayer } from '@zrinjski/core';
import { supabase } from './supabase';

export type PendingRegistration = {
  id: string;
  team_name: string;
  gender: Gender;
  rep_name: string;
  rep_email: string;
  player_count: number | null;
  players: RegistrationPlayer[];
  status: 'pending' | 'waitlist';
  created_at: string;
};

/** Kratica ekipe iz naziva — ista pravila kao u web adminu. */
function kratica(naziv: string): string {
  const rijeci = naziv.trim().split(/\s+/).filter(Boolean);
  if (rijeci.length === 0) return 'EKP';
  const iz =
    rijeci.length === 1
      ? rijeci[0]!.slice(0, 3)
      : rijeci.slice(0, 3).map((r) => r[0]).join('');
  const cist = iz.replace(/[^A-Za-zČĆŽŠĐčćžšđ0-9]/g, '').toUpperCase();
  return cist.length >= 2 ? cist : 'EKP';
}

export function useAdminRegistrations(enabled: boolean) {
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled || !supabase) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('registration')
        .select('id, team_name, gender, rep_name, rep_email, player_count, players, status, created_at')
        .in('status', ['pending', 'waitlist'])
        .order('created_at', { ascending: true });
      if (err) throw err;
      setItems((data ?? []) as PendingRegistration[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Odobrenje ide kroz istu funkciju koju zove i web admin.
   *
   * Namjerno se ne piše izravno u tablice: `approve_registration` u jednoj
   * transakciji stvara ekipu, prepisuje sastav i mijenja status. Da se to radi
   * rukom s telefona, prekinuta veza ostavila bi ekipu bez igrača.
   */
  const odobri = useCallback(
    async (reg: PendingRegistration) => {
      if (!supabase) return;
      setBusyId(reg.id);
      setError(null);
      try {
        const { error: err } = await supabase.rpc('approve_registration', {
          p_registration_id: reg.id,
          p_short_code: kratica(reg.team_name),
        });
        if (err) throw err;
        setItems((xs) => xs.filter((x) => x.id !== reg.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  return { items, loading, error, busyId, odobri, reload };
}
