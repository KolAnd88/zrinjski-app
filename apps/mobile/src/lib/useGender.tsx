// useGender.tsx — globalni odabir konkurencije (M/Ž).
// Jedan izbor vrijedi kroz sve ekrane (Poredak, Statistika…) i pamti se kroz restart.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gender } from '@zrinjski/core';

type Ctx = { gender: Gender; setGender: (g: Gender) => void };

const GenderContext = createContext<Ctx | null>(null);
const KEY = 'zrinjski.gender';

export function GenderProvider({ children }: { children: ReactNode }) {
  const [gender, setGenderState] = useState<Gender>('m');

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'm' || v === 'z') setGenderState(v);
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      gender,
      setGender: (g) => {
        setGenderState(g);
        void AsyncStorage.setItem(KEY, g);
      },
    }),
    [gender]
  );

  return <GenderContext.Provider value={value}>{children}</GenderContext.Provider>;
}

export function useGender() {
  const ctx = useContext(GenderContext);
  if (!ctx) throw new Error('useGender must be inside <GenderProvider>');
  return ctx;
}
