-- 0033_notify_new_registration.sql — nova prijava javi organizatoru.
--
-- Okidač zove edge funkciju `send-push`, koja bira uređaje označene kao
-- organizatorovi (vidi 0032) i šalje im obavijest.
--
-- Zašto migracija, a ne "Database Webhook" u sučelju: sučelje tu postavku
-- drži nevidljivom i neponovljivom. Ovako okidač stoji u repozitoriju i
-- obnovi se sam ako se baza ikad gradi iznova.
--
-- TAJNA NIJE OVDJE. Repozitorij je javan. Tajna se čuva u Supabase Vaultu
-- pod imenom `push_hook_secret`, a funkcija je čita u trenutku slanja.
-- Sprema se jednom, izvan repozitorija:
--
--   select vault.create_secret('TVOJA_TAJNA', 'push_hook_secret',
--                              'x-hook-secret za okidac nove prijave');
--
-- Anon ključ je namjerno upisan u funkciju, ne u Vault — nije tajna, već
-- stoji u netlify.toml i u svakoj objavljenoj aplikaciji. Vidi obrazloženje
-- uz `v_anon` ispod.
--
-- Ako obavijest ne stigne, odgovor se vidi ovdje:
--   select status_code, left(content,200), created
--   from net._http_response order by created desc limit 5;

create extension if not exists pg_net with schema extensions;

/**
 * Šalje obavijest o novoj prijavi.
 *
 * Dva zaglavlja, oba nužna:
 *   Authorization  — Supabase odbija poziv bez valjanog JWT-a PRIJE nego kod
 *                    edge funkcije uopće krene. Anon ključ je javan po dizajnu
 *                    i ovdje služi samo tome da poziv prođe platformu.
 *   x-hook-secret  — dokazuje edge funkciji da poziv dolazi iz baze.
 *
 * `net.http_post` je asinkron: upisuje zahtjev u red i vraća se odmah. To je
 * ovdje bitno — prijava ekipe NE SMIJE čekati na push, ni pasti ako Expo ne
 * odgovara. Ako slanje padne, prijava je svejedno spremljena.
 */
create or replace function public.notify_new_registration()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  /**
   * Anon ključ stoji OVDJE, a ne u Vaultu.
   *
   * Prvo je bio u Vaultu, uz tajnu — i to je bila greška. Anon ključ nije
   * tajna: isporučuje se u svakoj objavljenoj aplikaciji i već stoji u
   * netlify.toml i eas.json, dakle na javnom GitHubu. Skrivanjem javne
   * vrijednosti dobio se samo još jedan korak koji se može pokvariti — i
   * pokvario se: prepisivanjem kroz uređivač ključ je izgubio oblik i
   * Supabase je poziv odbio s "Invalid JWT".
   *
   * Zaštita je i dalje `push_hook_secret` iz Vaulta. Anon ključ samo
   * propušta poziv kroz Supabaseovu provjeru, kao i u svakom klijentu.
   */
  v_anon constant text :=
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWRxZnhsdHdodm5nZnhramZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NDkyNzgsImV4cCI6MjA5NzMyNTI3OH0.FcoKqxH-APXffBuBbyAdtO5qmfQrsCYuLFVHANrU7NA';
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'push_hook_secret';

  -- Bez tajne se ne šalje ništa. Tiho, jer ovo ne smije srušiti prijavu:
  -- klub koji se prijavljuje nije kriv što obavijest nije postavljena.
  if v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://iymdqfxltwhvngfxkjfy.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-hook-secret', v_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'registration',
      'record', to_jsonb(new)
    )
  );

  return new;
end;
$$;

comment on function public.notify_new_registration is
  'Javi organizatoru da je stigla nova prijava. Tajne iz Vaulta; nikad ne rusi prijavu.';

-- AFTER INSERT: obavijest ide tek kad je prijava stvarno spremljena.
-- Samo INSERT — kod odobrenja prijave organizator je taj koji djeluje, pa mu
-- ne treba obavijest o vlastitom potezu.
drop trigger if exists trg_registration_notify on public.registration;
create trigger trg_registration_notify
  after insert on public.registration
  for each row execute function public.notify_new_registration();
