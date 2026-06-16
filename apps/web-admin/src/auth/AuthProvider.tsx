import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DEMO, isSupabaseConfigured, supabase } from '../lib/supabase';

/** Lažna sesija za DEMO mod (preskakanje prave prijave). */
const demoSession = { user: { id: 'demo', email: 'demo@zrinjski.ba' } } as unknown as Session;

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false); // DEMO: bez sesije → prikaže se login (klik Prijava ulazi)
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      configured: isSupabaseConfigured || DEMO,
      async signInWithPassword(email, password) {
        if (DEMO) {
          setSession(demoSession);
          return { error: null };
        }
        if (!supabase) return { error: 'not_configured' };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signInWithMagicLink(email) {
        if (DEMO) {
          setSession(demoSession);
          return { error: null };
        }
        if (!supabase) return { error: 'not_configured' };
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        if (DEMO) {
          setSession(null);
          return;
        }
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth mora biti unutar <AuthProvider>');
  return ctx;
}
