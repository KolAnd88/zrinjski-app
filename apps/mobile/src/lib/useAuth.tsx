// useAuth.tsx — prijavljeni korisnik i njegova uloga.
//
// Do sada je uloga provjeravana samo u trenutku prijave i odmah zaboravljena,
// pa ekrani nisu mogli razlikovati admina od delegata. Ovo je drži na jednom
// mjestu — treba i zapisniku (tko smije ispravljati završenu utakmicu) i
// portalu predstavnika (koja je moja ekipa).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole = 'admin' | 'delegate' | 'rep';

type AuthValue = {
  session: Session | null;
  loading: boolean;
  role: UserRole | null;
  /** Ekipa predstavnika; null dok prijava nije odobrena. */
  teamId: string | null;
  /** Organizacija — smije unositi rezultate. */
  isStaff: boolean;
  /** Samo admin smije ispravljati završenu utakmicu. */
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!supabase || !uid) {
      setRole(null);
      setTeamId(null);
      setLoading(false);
      return;
    }
    const sb = supabase;
    const read = () => sb.from('app_user').select('role, team_id').eq('id', uid).maybeSingle();

    let { data } = await read();
    // Račun otvoren samostalnom registracijom još nema profil (vidi 0012).
    if (!data) {
      await sb.rpc('ensure_my_profile');
      ({ data } = await read());
    }
    setRole((data?.role as UserRole) ?? null);
    setTeamId(data?.team_id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadProfile(data.session?.user?.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      void loadProfile(s?.user?.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      loading,
      role,
      teamId,
      isStaff: role === 'admin' || role === 'delegate',
      isAdmin: role === 'admin',
      refresh: () => loadProfile(session?.user?.id),
      async signOut() {
        if (supabase) await supabase.auth.signOut();
        setRole(null);
        setTeamId(null);
      },
    }),
    [session, loading, role, teamId, loadProfile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth mora biti unutar <AuthProvider>');
  return ctx;
}
