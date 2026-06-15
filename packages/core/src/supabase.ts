// supabase.ts — tipizirani Supabase klijent (dijeljen mobilna + web).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types/database';

export type ZrinjskiClient = SupabaseClient<Database>;

export type CreateClientOptions = {
  url: string;
  anonKey: string;
  /**
   * Storage za auth sesiju. Na webu se koristi localStorage (default).
   * Na Expo/React Native proslijedi AsyncStorage:
   *   createZrinjskiClient({ url, anonKey, authStorage: AsyncStorage })
   */
  authStorage?: unknown;
  /** Detekcija sesije iz URL-a (magic-link) — true na webu, false na RN. */
  detectSessionInUrl?: boolean;
};

/**
 * Kreira tipizirani Supabase klijent za projekt.
 * Ključeve drži u .env (vidi .env.example) — nikad ih ne hardkodiraj.
 */
export function createZrinjskiClient(opts: CreateClientOptions): ZrinjskiClient {
  const { url, anonKey, authStorage, detectSessionInUrl = true } = opts;
  if (!url || !anonKey) {
    throw new Error(
      'createZrinjskiClient: nedostaje SUPABASE_URL ili SUPABASE_ANON_KEY (provjeri .env).'
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
      ...(authStorage ? { storage: authStorage as never } : {}),
    },
  });
}
