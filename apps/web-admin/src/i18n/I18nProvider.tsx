import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { strings, type Locale, type StringKey } from './strings';

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'zrinjski.locale';

function initialLocale(): Locale {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return saved === 'en' ? 'en' : 'hr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (l: Locale) => {
      setLocaleState(l);
      try {
        localStorage.setItem(STORAGE_KEY, l);
      } catch {
        /* ignore */
      }
    };
    const t = (key: StringKey, vars?: Record<string, string | number>) => {
      let out: string = strings[locale][key] ?? strings.hr[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return out;
    };
    return { locale, setLocale, t };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT mora biti unutar <I18nProvider>');
  return ctx;
}
