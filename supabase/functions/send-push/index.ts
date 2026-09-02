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
const EXPO_RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';
// Expo prima najviše 100 poruka po zahtjevu.
const CHUNK = 100;
// Potvrda isporuke nije spremna odmah; starije od ovoga sigurno jest.
const RECEIPT_MIN_AGE_MS = 90_000;

/**
 * CORS zaglavlja za preflight.
 *
 * Ranije je popis dopuštenih zaglavlja bio zakucan na četiri imena. Klijent je
 * uz njih slao i `x-region`, pa je preglednik odbijao preflight i POST NIKAD
 * nije krenuo — u Supabaseu se vidio samo `OPTIONS 200`, bez ijednog POST-a.
 * Obavijest se nije slala, a nigdje nije bilo greške jer zahtjev nije ni izašao
 * iz preglednika.
 *
 * Zato se sada uzvraća točno ono što je preglednik tražio: novo zaglavlje u
 * nekoj budućoj verziji klijenta ne može ponovno srušiti slanje.
 */
const corsFor = (req: Request): Record<string, string> => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    req.headers.get('Access-Control-Request-Headers') ??
    'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
});

/** Expove greške na koje ponavljanje ne pomaže. */
const PERMANENT = new Set(['MessageTooBig', 'InvalidCredentials', 'DeveloperError']);

/** Vrsta obavijesti → ključ u device.prefs. Uređaj koji ju je isključio se preskače. */
const PREF_KEY: Record<string, string> = {
  team_playing_soon: 'team_playing_soon',
  team_goal: 'team_goal',
  match_end: 'match_end',
  schedule_change: 'schedule_change',
  program: 'program',
};

Deno.serve(async (req) => {
  const cors = corsFor(req);
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

  /**
   * Obradi potvrde isporuke za RANIJA slanja.
   *
   * Expovo "ok" pri slanju znači samo da je poruku primio. Stvarni ishod stiže
   * tek u potvrdi, pa se bez ovoga greška poput isteklog FCM ključa nikad ne bi
   * vidjela — slanje bi izgledalo uspješno, a obavijest ne bi stizala.
   *
   * Nikad ne baca: ovo je pospremanje, a ne posao zbog kojeg obavijest smije pasti.
   */
  async function obradiPotvrde() {
    try {
      const prag = new Date(Date.now() - RECEIPT_MIN_AGE_MS).toISOString();
      const { data: karte } = await admin
        .from('push_ticket')
        .select('id, token')
        .is('checked_at', null)
        .lt('created_at', prag)
        .limit(300);
      if (!karte || karte.length === 0) return;

      const res = await fetch(EXPO_RECEIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids: karte.map((k) => k.id) }),
      });
      if (!res.ok) return; // Pokušat ćemo opet sljedeći put.
      const out = await res.json().catch(() => null);
      const potvrde = out?.data ?? {};

      const sad = new Date().toISOString();
      const mrtvi: string[] = [];
      for (const k of karte) {
        const p = potvrde[k.id];
        if (!p) continue; // Još nije spremna.
        const greska = p.details?.error ?? null;
        if (greska === 'DeviceNotRegistered') mrtvi.push(k.token);
        await admin
          .from('push_ticket')
          .update({ checked_at: sad, status: p.status ?? null, error: greska })
          .eq('id', k.id);
      }
      if (mrtvi.length > 0) {
        await admin.from('device').delete().in('expo_push_token', mrtvi);
      }
    } catch {
      // Pospremanje nikad ne smije oboriti slanje.
    }
  }


  // Potvrde za RANIJA slanja obraduju se PRIJE svega ostalog. Ranije su
  // stajale iza izlaza "nema uredaja", pa se u tom slucaju nisu ni dotakle.
  await obradiPotvrde();

  const payload = await req.json().catch(() => ({}));

  // Poziv samo radi potvrda, bez slanja. Admin ga okida pri otvaranju
  // Obavijesti, da zadnja poslana obavijest ne ostane zauvijek neprovjerena —
  // Expo potvrde brise nakon 24 sata, a inace se obraduju tek sljedecim slanjem.
  if (payload.receiptsOnly) return json({ receiptsOnly: true });

  // ── Ulaz ──────────────────────────────────────────────────────────────────
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
  /** Karte za kasniju provjeru isporuke. */
  const karte: { id: string; token: string }[] = [];
  const dead: string[] = [];
  let sent = 0;
  /** Greske koje ponavljanje NE bi rijesilo — samo se broje. */
  let permanent = 0;
  /** Nedostavljeno zbog privremene greske — zbog ovoga se cijeli poziv ponavlja. */
  let retryable = 0;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const slice = tokens.slice(i, i + CHUNK);
    const messages = slice.map((to) => ({
      to,
      title,
      body,
      sound: 'default',
      channelId: 'default',
    }));

    let res: Response | null = null;
    try {
      res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
    } catch {
      // Mreža je pukla — to je privremeno, pa se mora ponoviti.
      retryable += slice.length;
      continue;
    }

    // Expo zna vratiti 429/503 kad je pod opterećenjem. Ranije se takav komad
    // TIHO preskakao, a funkcija je svejedno vraćala uspjeh — uređaj bi
    // obavijest označio poslanom i nikad je ne bi ponovio.
    if (!res.ok) {
      retryable += slice.length;
      continue;
    }

    const out = await res.json().catch(() => null);
    if (!out) {
      retryable += slice.length;
      continue;
    }
    const tickets = out.data ?? [];

    tickets.forEach((ticket: { id?: string; status?: string; details?: { error?: string } }, n: number) => {
      if (ticket?.status === 'ok') {
        sent++;
        // Expo je poruku PRIMIO. Je li i isporučena, zna se tek iz potvrde.
        if (ticket.id) karte.push({ id: ticket.id, token: slice[n]! });
        return;
      }
      const err = ticket?.details?.error;
      if (err === 'DeviceNotRegistered') {
        // App odinstaliran ili token istekao — očisti da popis ne trune.
        dead.push(slice[n]!);
      } else if (PERMANENT.has(err ?? '')) {
        // Ponavljanje ne bi pomoglo; broji se da se vidi u odgovoru.
        permanent++;
      } else {
        // Sve ostalo (npr. MessageRateExceeded) prolazi kasnije.
        retryable += 1;
      }
    });
  }

  if (dead.length > 0) {
    await admin.from('device').delete().in('expo_push_token', dead);
  }
  if (karte.length > 0) {
    // Neuspjeh upisa ne smije oboriti slanje — obavijest je već otišla.
    await admin.from('push_ticket').upsert(karte, { onConflict: 'id' });
  }

  // Nedostavljeno zbog PRIVREMENE greške → pozivatelj mora znati da nije gotovo.
  // Vraća se 502 da `functions.invoke` prijavi grešku i red čekanja ponovi.
  //
  // Kod djelomičnog uspjeha ponavljanje šalje drugi put onima kojima je već
  // stiglo. To je svjesno: obavijest koja NIKAD ne stigne gora je od one koja
  // dođe dvaput, a komad je 100 uređaja pa je slučaj rijedak.
  if (retryable > 0) {
    return json({ sent, invalidated: dead.length, permanent, retryable, error: 'push_partial' }, 502);
  }

  return json({ sent, invalidated: dead.length, permanent, retryable: 0 });
});
