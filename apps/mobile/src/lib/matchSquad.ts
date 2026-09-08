// matchSquad.ts — sastav za pojedinu utakmicu, na telefonu.
//
// Delegat u dvorani zna tko je te večeri došao, a tko je ozlijeđen. Zato se
// sastav slaže ovdje, prije nego se pritisne "Počni" — poslije toga baza
// odbija izmjenu (migracija 0035).
//
// Prazan sastav znači "cijela ekipa". To nije nedostatak nego zadano stanje:
// ako nitko ništa ne posloži, sve radi kao i prije.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export function useMatchSquad(matchId: string | undefined) {
  /** ID-evi igrača na zapisniku, obje ekipe zajedno. */
  const [squad, setSquad] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!matchId || !supabase) return;
    const { data, error: err } = await supabase
      .from('match_player')
      .select('player_id')
      .eq('match_id', matchId);
    // Tiho: sastav je dopuna, a prazno ionako znaci "cijela ekipa". Unos
    // rezultata ne smije stati zato sto se dodatak nije ucitao.
    if (err) return;
    setSquad((data ?? []).map((r) => r.player_id as string));
  }, [matchId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Spremi sastav jedne ekipe. Druga ostaje netaknuta.
   *
   * Ide kroz RPC koji zamjenu radi u jednoj transakciji — veza u dvorani zna
   * pasti nasred posla, a polovicno spremljen sastav bio bi gori od nikakvog.
   */
  const spremi = useCallback(
    async (teamId: string, playerIds: string[], sviIgraciEkipe: string[]) => {
      if (!matchId || !supabase) return false;
      setBusy(true);
      setError(null);
      try {
        const { error: err } = await supabase.rpc('set_match_squad', {
          p_match_id: matchId,
          p_team_id: teamId,
          p_player_ids: playerIds,
        });
        if (err) throw err;
        // Lokalno stanje: makni sve igrace te ekipe pa dodaj nove.
        const tudji = new Set(sviIgraciEkipe);
        setSquad((prev) => [...prev.filter((id) => !tudji.has(id)), ...playerIds]);
        return true;
      } catch (e) {
        const poruka = e instanceof Error ? e.message : String(e);
        setError(poruka.includes('squad_locked') ? 'locked' : poruka);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [matchId]
  );

  /**
   * Igrači te ekipe koji igraju ovu utakmicu.
   *
   * Kad sastav nije složen, vraća sve — pa unos gola radi kao i prije. Kad
   * jest, popis za odabir strijelca je kraći, što je uz teren cijela razlika.
   */
  const igraciZaUnos = useCallback(
    <T extends { id: string }>(sviEkipe: T[]): T[] => {
      const u = new Set(squad);
      const probrani = sviEkipe.filter((p) => u.has(p.id));
      return probrani.length > 0 ? probrani : sviEkipe;
    },
    [squad]
  );

  return { squad, busy, error, spremi, reload, igraciZaUnos };
}
