// supabase.ts — Supabase klijent za web admin (koristi dijeljeni @zrinjski/core).
import { createZrinjskiClient, type ZrinjskiClient } from '@zrinjski/core';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Je li Supabase konfiguriran (postoje URL + anon ključ u .env). */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * DEMO mod: kad Supabase NIJE konfiguriran, web admin radi na lokalnim demo
 * podacima (u memoriji) uz preskakanje prijave — da se sve može pregledati
 * offline. Ukloni se prirodno čim se postavi .env (tada DEMO = false).
 */
export const DEMO = !isSupabaseConfigured;

/** Imamo li izvor podataka (pravi Supabase ILI demo). Sada uvijek true. */
export const HAS_DATA = isSupabaseConfigured || DEMO;

/**
 * Klijent je `null` dok se ne postavi .env — UI to gracefulno prikaže
 * umjesto da pukne. Kad se postavi, sve radi normalno.
 */
export const supabase: ZrinjskiClient | null = isSupabaseConfigured
  ? createZrinjskiClient({ url: url!, anonKey: anonKey!, detectSessionInUrl: true })
  : null;
