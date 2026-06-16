import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { strings, type Locale, type StringKey } from './strings';

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<Ctx | null>(null);
const KEY = 'zrinjski.locale';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('hr');

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'en' || v === 'hr') setLocaleState(v);
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const setLocale = (l: Locale) => {
      setLocaleState(l);
      void AsyncStorage.setItem(KEY, l);
    };
    const t = (key: StringKey, vars?: Record<string, string | number>) => {
      let out: string = strings[locale][key] ?? strings.hr[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
      return out;
    };
    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be inside <I18nProvider>');
  return ctx;
}
