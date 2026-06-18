// admin-users — Supabase Edge Function (Deno).
// Sigurno kreiranje/brisanje korisnika: poziva ga SAMO prijavljeni admin/delegate.
// Koristi service_role ključ (dostupan samo na serveru) za auth admin operacije.
//
// Deploy: Supabase ploča → Edge Functions → Deploy a new function → ime "admin-users"
// → zalijepi ovaj kod → Deploy. (verify_jwt ostaje uključen — samo prijavljeni mogu zvati.)
//
// Vraća uvijek HTTP 200 s { ok: boolean, error?: string } radi jednostavne obrade u klijentu.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // 1) Identificiraj pozivatelja iz njegovog tokena.
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await caller.auth.getUser();
  const caller_id = userData.user?.id;
  if (!caller_id) return reply({ ok: false, error: 'Niste prijavljeni.' });

  // 2) Provjeri da je pozivatelj admin/delegate (preko service klijenta).
  const admin = createClient(url, serviceKey);
  const { data: me } = await admin.from('app_user').select('role').eq('id', caller_id).maybeSingle();
  if (!me || !['admin', 'delegate'].includes(me.role)) {
    return reply({ ok: false, error: 'Nemate ovlasti.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return reply({ ok: false, error: 'Neispravan zahtjev.' });
  }
  const action = String(payload.action ?? '');

  // 3a) Kreiraj korisnika
  if (action === 'create') {
    const email = String(payload.email ?? '').trim();
    const password = String(payload.password ?? '');
    const role = String(payload.role ?? 'delegate');
    const team_id = (payload.team_id as string | null) ?? null;
    if (!email || password.length < 6) {
      return reply({ ok: false, error: 'E-mail i lozinka (min. 6 znakova) su obavezni.' });
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) return reply({ ok: false, error: error?.message ?? 'Greška pri kreiranju.' });
    const { error: upErr } = await admin.from('app_user').upsert({ id: created.user.id, email, role, team_id });
    if (upErr) return reply({ ok: false, error: upErr.message });
    return reply({ ok: true, id: created.user.id });
  }

  // 3b) Obriši korisnika (kaskadno briše i app_user red preko FK)
  if (action === 'delete') {
    const target_id = String(payload.id ?? '');
    if (!target_id) return reply({ ok: false, error: 'Nedostaje id.' });
    if (target_id === caller_id) return reply({ ok: false, error: 'Ne možeš obrisati sebe.' });
    const { error } = await admin.auth.admin.deleteUser(target_id);
    if (error) return reply({ ok: false, error: error.message });
    return reply({ ok: true });
  }

  return reply({ ok: false, error: 'Nepoznata akcija.' });
});
