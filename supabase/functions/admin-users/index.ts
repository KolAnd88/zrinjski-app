// admin-users — Supabase Edge Function (Deno).
// Sigurno kreiranje/uređivanje/brisanje korisnika: poziva ga SAMO admin.
// Koristi service_role ključ (dostupan samo na serveru) za auth admin operacije.
//
// Deploy: Supabase ploča → Edge Functions → Deploy a new function → ime "admin-users"
// → zalijepi ovaj kod → Deploy. (verify_jwt ostaje uključen — samo prijavljeni mogu zvati.)
//
// Vraća uvijek HTTP 200 s { ok: boolean, error?: string } radi jednostavne obrade u klijentu.
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Uzvraća točno ona zaglavlja koja je preglednik tražio. Zakucan popis je na
// `send-push` tiho blokirao svaki POST jer klijent šalje i `x-region` — ista
// zamka vrijedi i ovdje, pa se zatvara na isti način.
const corsFor = (req: Request): Record<string, string> => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    req.headers.get('Access-Control-Request-Headers') ??
    'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
});


const VALID_ROLES = ['admin', 'delegate', 'rep'] as const;

function validRole(value: unknown): value is (typeof VALID_ROLES)[number] {
  return VALID_ROLES.includes(String(value) as (typeof VALID_ROLES)[number]);
}

Deno.serve(async (req) => {
  const cors = corsFor(req);
  const reply = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

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

  // 2) Provjeri da je pozivatelj pravi admin (preko service klijenta).
  // Delegat vodi utakmice i raspored, ali ne smije stvarati druge admine.
  const admin = createClient(url, serviceKey);
  const { data: me } = await admin.from('app_user').select('role').eq('id', caller_id).maybeSingle();
  if (!me || me.role !== 'admin') {
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
    const requestedTeamId = String(payload.team_id ?? '').trim() || null;
    if (!email || password.length < 6) {
      return reply({ ok: false, error: 'E-mail i lozinka (min. 6 znakova) su obavezni.' });
    }
    if (!validRole(role)) return reply({ ok: false, error: 'Neispravna uloga.' });
    if (role === 'rep' && !requestedTeamId) {
      return reply({ ok: false, error: 'Predstavnik mora biti vezan uz ekipu.' });
    }
    const team_id = role === 'rep' ? requestedTeamId : null;
    if (team_id) {
      const { data: team } = await admin.from('team').select('id').eq('id', team_id).maybeSingle();
      if (!team) return reply({ ok: false, error: 'Odabrana ekipa ne postoji.' });
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !created.user) return reply({ ok: false, error: error?.message ?? 'Greška pri kreiranju.' });
    const { error: upErr } = await admin.from('app_user').upsert({ id: created.user.id, email, role, team_id });
    if (upErr) {
      // Ne ostavljaj Auth korisnika bez app_user profila ako drugi korak padne.
      await admin.auth.admin.deleteUser(created.user.id);
      return reply({ ok: false, error: upErr.message });
    }
    return reply({ ok: true, id: created.user.id });
  }

  // 3b) Promijeni ulogu / ekipu predstavnika.
  if (action === 'update_access') {
    const target_id = String(payload.id ?? '');
    const role = String(payload.role ?? '');
    const requestedTeamId = String(payload.team_id ?? '').trim() || null;
    if (!target_id || !validRole(role)) return reply({ ok: false, error: 'Neispravni podaci.' });
    if (target_id === caller_id && role !== 'admin') {
      return reply({ ok: false, error: 'Ne možeš ukloniti vlastitu admin ulogu.' });
    }
    if (role === 'rep' && !requestedTeamId) {
      return reply({ ok: false, error: 'Predstavnik mora biti vezan uz ekipu.' });
    }
    const team_id = role === 'rep' ? requestedTeamId : null;
    if (team_id) {
      const { data: team } = await admin.from('team').select('id').eq('id', team_id).maybeSingle();
      if (!team) return reply({ ok: false, error: 'Odabrana ekipa ne postoji.' });
    }
    const { error } = await admin.from('app_user').update({ role, team_id }).eq('id', target_id);
    if (error) return reply({ ok: false, error: error.message });
    return reply({ ok: true });
  }

  // 3c) Obriši korisnika (kaskadno briše i app_user red preko FK)
  if (action === 'delete') {
    const target_id = String(payload.id ?? '');
    if (!target_id) return reply({ ok: false, error: 'Nedostaje id.' });
    if (target_id === caller_id) return reply({ ok: false, error: 'Ne možeš obrisati sebe.' });
    const { data: target } = await admin.from('app_user').select('role').eq('id', target_id).maybeSingle();
    if (!target) return reply({ ok: false, error: 'Korisnik ne postoji.' });
    if (target.role === 'admin') {
      const { count } = await admin
        .from('app_user')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      if ((count ?? 0) <= 1) return reply({ ok: false, error: 'Ne možeš obrisati posljednjeg admina.' });
    }
    const { error } = await admin.auth.admin.deleteUser(target_id);
    if (error) return reply({ ok: false, error: error.message });
    return reply({ ok: true });
  }

  return reply({ ok: false, error: 'Nepoznata akcija.' });
});
