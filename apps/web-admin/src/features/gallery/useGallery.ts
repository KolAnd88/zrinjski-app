import { useCallback, useEffect, useState } from 'react';
import type { Day, GalleryPhoto } from '@zrinjski/core';
import { DEMO, HAS_DATA } from '../../lib/supabase';
import {
  addGalleryPhoto,
  deleteGalleryPhoto,
  fetchDays,
  fetchGalleryPhotos,
} from '../../lib/data';

export type GalleryData = {
  loading: boolean;
  demo: boolean;
  error: string | null;
  photos: GalleryPhoto[];
  days: Day[];
  add: (dayId: string | null, file: File) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useGallery(tournamentId: string | null): GalleryData {
  const [loading, setLoading] = useState(HAS_DATA && !!tournamentId);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [days, setDays] = useState<Day[]>([]);

  const reload = useCallback(async () => {
    if (!tournamentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [ps, ds] = await Promise.all([
        fetchGalleryPhotos(tournamentId),
        fetchDays(tournamentId),
      ]);
      setPhotos(ps);
      setDays(ds);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const add = useCallback(
    async (dayId: string | null, file: File) => {
      if (!tournamentId) return;
      const created = await addGalleryPhoto(tournamentId, dayId, file);
      setPhotos((xs) => [created, ...xs]);
    },
    [tournamentId]
  );

  const remove = useCallback(async (id: string) => {
    await deleteGalleryPhoto(id);
    setPhotos((xs) => xs.filter((p) => p.id !== id));
  }, []);

  return { loading, demo: DEMO, error, photos, days, add, remove };
}
