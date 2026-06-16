// supabase.ts — Supabase klijent za mobilnu app (AsyncStorage za sesiju).
// Gledatelji ne trebaju login; klijent koristi anon ključ za javno čitanje + realtime.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createZrinjskiClient, type ZrinjskiClient } from '@zrinjski/core';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: ZrinjskiClient | null = isSupabaseConfigured
  ? createZrinjskiClient({
      url: url!,
      anonKey: anonKey!,
      authStorage: AsyncStorage,
      detectSessionInUrl: false,
    })
  : null;
