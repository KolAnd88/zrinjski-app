import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { DEMO, isSupabaseConfigured, supabase } from '../lib/supabase';

/** Lažna sesija za DEMO mod (preskakanje prave prijave). */
const demoSession = { user: { id: 'demo', email: 'demo@zrinjski.ba' } } as unknown as Session;

/** Uloga prijavljenog korisnika: organizacija (admin/delegate) ili predstavnik ekipe (rep). */
export type UserRole = 'admin' | 'delegate' | 'rep';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  /** Uloga iz app_user; null dok se ne učita ili ako red ne postoji. */
  role: UserRole | null;
  /** Ekipa predstavnika (samo za ulogu 'rep'). */
  teamId: string | null;
  /** Ima li pristup admin sučelju (admin ili delegate). */
  isStaff: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Otvaranje racuna predstavnika. Okidac u bazi dodijeli ulogu 'rep' bez ekipe. */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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

  // Profil (uloga + ekipa) — RLS dopušta čitanje vlastitog app_user reda.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!supabase || !uid) {
      setRole(DEMO ? 'admin' : null); // DEMO: pretvaraj se da je organizator
      setTeamId(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    void supabase
      .from('app_user')
      .select('role, team_id')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setRole((data?.role as UserRole) ?? null);
        setTeamId(data?.team_id ?? null);
        setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      // Dok se profil učitava ne znamo kamo usmjeriti korisnika → drži "loading".
      loading: loading || profileLoading,
      configured: isSupabaseConfigured || DEMO,
      role,
      teamId,
      isStaff: role === 'admin' || role === 'delegate',
      async signUp(email, password) {
        if (DEMO) {
          setSession(demoSession);
          return { error: null, needsConfirm: false };
        }
        if (!supabase) return { error: 'not_configured', needsConfirm: false };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        // Bez sesije znaci da Supabase trazi potvrdu e-maila prije prijave.
        return { error: error?.message ?? null, needsConfirm: !error && !data.session };
      },
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
    [session, loading, profileLoading, role, teamId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth mora biti unutar <AuthProvider>');
  return ctx;
}
