// useFollow.tsx — praćene ekipe + postavke obavijesti (AsyncStorage).
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationPrefs } from '@zrinjski/core';

const FOLLOW_KEY = 'zrinjski.followed';
const PREFS_KEY = 'zrinjski.notifPrefs';
const MASTER_KEY = 'zrinjski.notifMaster';

const defaultPrefs: NotificationPrefs = {
  team_playing_soon: true,
  team_goal: true,
  match_end: true,
  schedule_change: true,
  program: false,
};

type FollowCtx = {
  followed: string[];
  isFollowing: (teamId: string) => boolean;
  toggleFollow: (teamId: string) => void;
  prefs: NotificationPrefs;
  setPref: (key: keyof NotificationPrefs, val: boolean) => void;
  master: boolean;
  setMaster: (val: boolean) => void;
};

const Ctx = createContext<FollowCtx | null>(null);

export function FollowProvider({ children }: { children: ReactNode }) {
  const [followed, setFollowed] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [master, setMasterState] = useState(true);

  useEffect(() => {
    void (async () => {
      const [f, p, mst] = await Promise.all([
        AsyncStorage.getItem(FOLLOW_KEY),
        AsyncStorage.getItem(PREFS_KEY),
        AsyncStorage.getItem(MASTER_KEY),
      ]);
      if (f) setFollowed(JSON.parse(f));
      if (p) setPrefs({ ...defaultPrefs, ...JSON.parse(p) });
      if (mst != null) setMasterState(mst === '1');
    })();
  }, []);

  const value = useMemo<FollowCtx>(
    () => ({
      followed,
      isFollowing: (id) => followed.includes(id),
      toggleFollow: (id) => {
        setFollowed((prev) => {
          const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
          void AsyncStorage.setItem(FOLLOW_KEY, JSON.stringify(next));
          return next;
        });
      },
      prefs,
      setPref: (key, val) => {
        setPrefs((prev) => {
          const next = { ...prev, [key]: val };
          void AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
          return next;
        });
      },
      master,
      setMaster: (val) => {
        setMasterState(val);
        void AsyncStorage.setItem(MASTER_KEY, val ? '1' : '0');
      },
    }),
    [followed, prefs, master]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFollow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFollow must be inside <FollowProvider>');
  return ctx;
}
