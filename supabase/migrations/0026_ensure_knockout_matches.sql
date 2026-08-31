-- 0026_ensure_knockout_matches.sql — utakmice završnice pravi baza, ne preglednik.
--
-- Provjera "koje utakmice nedostaju" bila je samo u pregledniku. Dva
-- organizatora mogu istodobno vidjeti da nedostaju i obojica ih napraviti —
-- turnir tada ima cetiri polufinala i dva finala, a nitko ne zna koje je pravo.
--
-- Zakljucavanje ide preko `pg_advisory_xact_lock` nad (turnir, spol): drugi
-- poziv ceka prvi, pa nakon njega vidi da vise nista ne nedostaje i ne napravi
-- nista. Brava se sama otpusta na kraju transakcije.
--
-- Zasto brava a ne unique indeks: polufinala su DVA, pa jednostavan unique
-- nad (turnir, spol, faza) ne bi prosao.
--
-- Idempotentno: `create or replace`.

create or replace function public.ensure_knockout_matches(
  p_tournament_id uuid,
  p_gender text,
  p_day_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created integer := 0;
  v_order   integer;
  v_semis   integer;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Dva istodobna poziva se serijaliziraju; drugi zatekne posao gotovim.
  perform pg_advisory_xact_lock(hashtext(p_tournament_id::text || p_gender));

  select coalesce(max(sort_order), -1) + 1 into v_order
  from public.match where tournament_id = p_tournament_id;

  select count(*) into v_semis
  from public.match
  where tournament_id = p_tournament_id and gender = p_gender::public.gender
    and stage = 'semifinal';

  if v_semis < 1 then
    insert into public.match (tournament_id, gender, stage, home_placeholder, away_placeholder, day_id, sort_order)
    values (p_tournament_id, p_gender::public.gender, 'semifinal', 'A1', 'B2', p_day_id, v_order);
    v_order := v_order + 1; v_created := v_created + 1;
  end if;
  if v_semis < 2 then
    insert into public.match (tournament_id, gender, stage, home_placeholder, away_placeholder, day_id, sort_order)
    values (p_tournament_id, p_gender::public.gender, 'semifinal', 'A2', 'B1', p_day_id, v_order);
    v_order := v_order + 1; v_created := v_created + 1;
  end if;

  if not exists (
    select 1 from public.match
    where tournament_id = p_tournament_id and gender = p_gender::public.gender and stage = 'third_place'
  ) then
    insert into public.match (tournament_id, gender, stage, home_placeholder, away_placeholder, day_id, sort_order)
    values (p_tournament_id, p_gender::public.gender, 'third_place', 'Poraženi PF1', 'Poraženi PF2', p_day_id, v_order);
    v_order := v_order + 1; v_created := v_created + 1;
  end if;

  if not exists (
    select 1 from public.match
    where tournament_id = p_tournament_id and gender = p_gender::public.gender and stage = 'final'
  ) then
    insert into public.match (tournament_id, gender, stage, home_placeholder, away_placeholder, day_id, sort_order)
    values (p_tournament_id, p_gender::public.gender, 'final', 'Pobjednik PF1', 'Pobjednik PF2', p_day_id, v_order);
    v_created := v_created + 1;
  end if;

  return v_created;
end;
$$;

comment on function public.ensure_knockout_matches(uuid, text, uuid) is
  'Napravi utakmice zavrsnice koje nedostaju, bez duplikata i kod istodobnih poziva. Vraca broj napravljenih.';

grant execute on function public.ensure_knockout_matches(uuid, text, uuid) to authenticated;
