import { useCallback, useEffect, useState } from 'react';
import type { Sponsor, SponsorTier } from '@zrinjski/core';
import { HAS_DATA } from '../../lib/supabase';
import {
  createSponsor,
  deleteSponsor,
  fetchSponsors,
  updateSponsor,
  uploadPublicAsset,
} from '../../lib/data';

export type SponsorInput = {
  id?: string;
  name: string;
  tier: SponsorTier;
  is_active: boolean;
  logo_url: string | null;
  file: File | null;
};

export type SponsorsData = {
  loading: boolean;
  configured: boolean;
  error: string | null;
  gold: Sponsor | null;
  others: Sponsor[];
  saveSponsor: (input: SponsorInput) => Promise<void>;
  removeSponsor: (id: string) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
};

export function useSponsors(tournamentId: string | null): SponsorsData {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  const reload = useCallback(async () => {
    if (!HAS_DATA || !tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSponsors(await fetchSponsors(tournamentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveSponsor = useCallback(
    async (input: SponsorInput) => {
      if (!tournamentId) return;
      let logoUrl = input.logo_url;
      if (input.file) logoUrl = await uploadPublicAsset(input.file, 'sponsors');

      if (input.id) {
        await updateSponsor(input.id, {
          name: input.name,
          tier: input.tier,
          is_active: input.is_active,
          logo_url: logoUrl,
        });
        setSponsors((xs) =>
          xs.map((s) =>
            s.id === input.id
              ? { ...s, name: input.name, tier: input.tier, is_active: input.is_active, logo_url: logoUrl }
              : s
          )
        );
      } else {
        const created = await createSponsor({
          tournament_id: tournamentId,
          name: input.name,
          tier: input.tier,
          is_active: input.is_active,
          logo_url: logoUrl,
          sort_order: sponsors.length,
        });
        setSponsors((xs) => [...xs, created]);
      }
    },
    [tournamentId, sponsors.length]
  );

  const removeSponsor = useCallback(async (id: string) => {
    await deleteSponsor(id);
    setSponsors((xs) => xs.filter((s) => s.id !== id));
  }, []);

  const setActive = useCallback(async (id: string, active: boolean) => {
    await updateSponsor(id, { is_active: active });
    setSponsors((xs) => xs.map((s) => (s.id === id ? { ...s, is_active: active } : s)));
  }, []);

  const gold = sponsors.find((s) => s.tier === 'gold') ?? null;
  const others = sponsors.filter((s) => s.tier !== 'gold');

  return {
    loading,
    configured: HAS_DATA,
    error,
    gold,
    others,
    saveSponsor,
    removeSponsor,
    setActive,
  };
}
