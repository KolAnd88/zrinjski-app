// send-push — pošalji push obavijest uređajima prema publici (audience).
//
// Zove ga web/mobilni admin nakon upisa u notification_log. Koristi service_role
// ključ (samo na serveru) jer mora čitati tuđe uređaje i tokene.
//
// Publika (audience), isti format kao u notification_log:
//   'all'                 → svi uređaji
//   'team:<team_id>'      → uređaji koji prate tu ekipu
//   'followers:<team_id>' → isto (zadržano zbog kompatibilnosti)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo prima najviše 100 poruka po zahtjevu.
const CHUNK = 100;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Vrsta obavijesti → ključ u device.prefs. Uređaj koji ju je isključio se preskače. */
const PREF_KEY: Record<string, string> = {
  team_playing_soon: 'team_playing_soon',
  team_goal: 'team_goal',
  match_end: 'match_end',
  schedule_change: 'schedule_change',
  program: 'program',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // ── Samo organizatori smiju slati ─────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '');
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  const { data: caller } = await admin.auth.getUser(jwt);
  const callerId = caller?.user?.id;
  if (!callerId) return json({ error: 'unauthorized' }, 401);

  const { data: me } = await admin
    .from('app_user')
    .select('role')
    .eq('id', callerId)
    .maybeSingle();
  if (!me || !['admin', 'delegate'].includes(me.role)) {
    return json({ error: 'forbidden' }, 403);
  }

  // ── Ulaz ──────────────────────────────────────────────────────────────────
  const payload = await req.json().catch(() => ({}));
  const audience = String(payload.audience ?? 'all');
  const title = String(payload.title ?? '').trim();
  const body = payload.body ? String(payload.body) : undefined;
  const type = String(payload.type ?? '');
  if (!title) return json({ error: 'title_required' }, 400);

  // ── Odaberi uređaje ───────────────────────────────────────────────────────
  let q = admin
    .from('device')
    .select('expo_push_token, prefs')
    .eq('enabled', true)
    .not('expo_push_token', 'is', null);

  const teamMatch = audience.match(/^(?:team|followers):(.+)$/);
  if (teamMatch) {
    q = q.contains('followed_team_ids', [teamMatch[1]]);
  }

  const { data: devices, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const prefKey = PREF_KEY[type];
  const tokens = (devices ?? [])
    // Uređaj koji je isključio baš ovu vrstu obavijesti ne dobiva ništa.
    .filter((d) => !prefKey || (d.prefs as Record<string, boolean>)?.[prefKey] !== false)
    .map((d) => d.expo_push_token as string);

  if (tokens.length === 0) return json({ sent: 0, invalidated: 0 });

  // ── Pošalji Expou u komadima ──────────────────────────────────────────────
  const dead: string[] = [];
  let sent = 0;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const slice = tokens.slice(i, i + CHUNK);
    const messages = slice.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      channelId: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    if (!res.ok) continue;
    const out = await res.json().catch(() => null);
    const tickets = out?.data ?? [];

    tickets.forEach((ticket: { status?: string; details?: { error?: string } }, n: number) => {
      if (ticket?.status === 'ok') {
        sent++;
      } else if (ticket?.details?.error === 'DeviceNotRegistered') {
        // App odinstaliran ili token istekao — očisti da popis ne trune.
        dead.push(slice[n]!);
      }
    });
  }

  if (dead.length > 0) {
    await admin.from('device').delete().in('expo_push_token', dead);
  }

  return json({ sent, invalidated: dead.length });
});
