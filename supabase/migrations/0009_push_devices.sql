-- 0009_push_devices.sql — registracija uređaja za push obavijesti.
--
-- Uređaj (gledatelj) nema korisnički račun, pa mora pisati anonimno. Umjesto da
-- otvorimo INSERT/UPDATE politiku nad `device` (čime bi bilo tko mogao PostgREST-om
-- prepisati SVE redove odjednom), pisanje ide isključivo kroz `register_device`.
-- Funkcija je security definer i uvijek dira samo red koji odgovara tokenu —
-- a Expo push token je nepogodiv niz koji zna samo taj uređaj.

-- Glavni prekidač obavijesti u aplikaciji; isključen uređaj ostaje u bazi
-- (da zadrži postavke) ali ga slanje preskače.
alter table public.device
  add column if not exists enabled boolean not null default true;

create or replace function public.register_device(
  p_token    text,
  p_language text default 'hr',
  p_followed uuid[] default '{}',
  p_prefs    jsonb default null,
  p_enabled  boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Bez tokena nema što registrirati (npr. emulator ili odbijena dopuštenja).
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  insert into public.device (expo_push_token, language, followed_team_ids, prefs, enabled)
  values (
    p_token,
    coalesce(p_language, 'hr'),
    coalesce(p_followed, '{}'),
    coalesce(p_prefs, '{"team_playing_soon":true,"team_goal":true,"match_end":true,"schedule_change":true,"program":false}'::jsonb),
    coalesce(p_enabled, true)
  )
  on conflict (expo_push_token) do update
    set language          = excluded.language,
        followed_team_ids = excluded.followed_team_ids,
        prefs             = excluded.prefs,
        enabled           = excluded.enabled,
        updated_at        = now();
end;
$$;

comment on function public.register_device is
  'Upis/ažuriranje uređaja za push. Jedini put za anonimni zapis u device.';

-- Anonimni (gledatelj) i prijavljeni smiju samo pozvati funkciju — ne i pisati po tablici.
revoke all on function public.register_device(text, text, uuid[], jsonb, boolean) from public;
grant execute on function public.register_device(text, text, uuid[], jsonb, boolean) to anon, authenticated;
