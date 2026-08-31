-- 0027_registration_players_and_push_state.sql
--
-- Dvije stvari koje su radile u DEMO nacinu, a na zivoj bazi ne bi.
--
-- ── 1. Uredivanje sastava u prijavi ────────────────────────────────────────
-- Novi ekran je pisao izravno u `registration`. RLS pravilo za admina postoji
-- (0002), ali je 0011 OVLAST NAD TABLICOM oduzeo:
--     revoke insert, update, delete on table public.registration
--       from anon, authenticated;
-- Pravilo tada nema sto dopustiti — upis pada s "permission denied". Zato
-- izmjena ide kroz funkciju, kao i sve ostalo sto dira prijave.
--
-- ── 2. Obavijest se mogla IZGUBITI ─────────────────────────────────────────
-- Uredaj je zapis u dnevnik koristio kao branu protiv dvostrukog slanja: ako
-- zapis vec postoji, ne salji. Ali ako je prosli pokusaj zapisao red pa mu je
-- SLANJE palo, sljedeci pokusaj vidi zapis i zakljuci da je posao gotov —
-- obavijest se nikad ne posalje.
--
-- "Zabiljezeno" i "poslano" su dva razlicita stanja i moraju se razlikovati.
--
-- Idempotentno.

-- ── Stanje slanja ──────────────────────────────────────────────────────────
alter table public.notification_log
  add column if not exists push_sent_at timestamptz;

comment on column public.notification_log.push_sent_at is
  'Kada je push STVARNO poslan. NULL = zabiljezeno, ali jos neposlano — ponovni pokusaj ga smije poslati.';

-- ── Sastav u prijavi ───────────────────────────────────────────────────────
create or replace function public.set_registration_players(
  p_registration_id uuid,
  p_players jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if jsonb_typeof(p_players) <> 'array' then
    raise exception 'players_must_be_array' using errcode = 'P0001';
  end if;

  -- Samo prijava koja JOS CEKA. Odobrena je vec postala ekipa s igracima; da
  -- se tada mijenja sastav prijave, dvije bi se strane tiho razisle.
  update public.registration
     set players = p_players,
         player_count = jsonb_array_length(p_players)
   where id = p_registration_id
     and status = 'pending';

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'registration_not_pending' using errcode = 'P0001';
  end if;

  return jsonb_array_length(p_players);
end;
$$;

comment on function public.set_registration_players(uuid, jsonb) is
  'Promijeni sastav u prijavi koja ceka odobrenje. Samo organizacija; odobrene prijave se ne diraju.';

grant execute on function public.set_registration_players(uuid, jsonb) to authenticated;
