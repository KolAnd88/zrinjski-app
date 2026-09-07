-- 0032_staff_devices.sql — uređaj zna pripada li organizatoru.
--
-- Tablica `device` do sada je bila potpuno anonimna: token, jezik, praćene
-- ekipe. To je bilo dovoljno dok su obavijesti išle gledateljima ili
-- navijačima jedne ekipe. Nije dovoljno za obavijest koja mora stići SAMO
-- organizatoru — npr. "stigla je nova prijava ekipe".
--
-- Zato uređaj pamti tko je bio prijavljen kad se registrirao.

alter table public.device
  add column if not exists staff_user_id uuid references public.app_user(id) on delete set null;

comment on column public.device.staff_user_id is
  'Organizator prijavljen na ovom uređaju, ako ga ima. NULL = obicni gledatelj.';

-- Slanje organizatorima bira uređaje po ovom stupcu, pa mu treba indeks.
-- Djelomičan je jer je golema većina uređaja gledateljska, dakle NULL.
create index if not exists idx_device_staff
  on public.device (staff_user_id)
  where staff_user_id is not null;

/**
 * Registracija uređaja sada bilježi i organizatora.
 *
 * `auth.uid()` radi i unutar security definer funkcije — definer mijenja
 * OVLASTI, ne token pozivatelja. Zato klijent ne mora ništa slati ni znati:
 * ako je u trenutku registracije prijavljen organizator, uređaj to zapamti.
 *
 * Provjerava se uloga, ne samo prijavljenost: predstavnik ekipe (`rep`) je
 * također prijavljen, a njemu obavijesti o prijavama drugih klubova ne idu.
 *
 * Odjava briše oznaku pri sljedećoj registraciji — tada je `auth.uid()` NULL,
 * pa tuđi telefon ne nastavi primati obavijesti organizatora.
 */
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
declare
  v_staff uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  select u.id into v_staff
  from public.app_user u
  where u.id = auth.uid() and u.role in ('admin', 'delegate');

  insert into public.device (expo_push_token, language, followed_team_ids, prefs, enabled, staff_user_id)
  values (
    p_token,
    coalesce(p_language, 'hr'),
    coalesce(p_followed, '{}'),
    coalesce(p_prefs, '{"team_playing_soon":true,"team_goal":true,"match_end":true,"schedule_change":true,"program":false}'::jsonb),
    coalesce(p_enabled, true),
    v_staff
  )
  on conflict (expo_push_token) do update
    set language          = excluded.language,
        followed_team_ids = excluded.followed_team_ids,
        prefs             = excluded.prefs,
        enabled           = excluded.enabled,
        staff_user_id     = excluded.staff_user_id;
end;
$$;

comment on function public.register_device is
  'Upis/azuriranje uredaja za push. Jedini put za anonimni zapis u device. Pamti i organizatora ako je prijavljen.';

revoke all on function public.register_device(text, text, uuid[], jsonb, boolean) from public;
grant execute on function public.register_device(text, text, uuid[], jsonb, boolean) to anon, authenticated;
