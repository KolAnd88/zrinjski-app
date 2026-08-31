-- 0025_slot_rpc_all_or_nothing.sql — skupni upisi su ili potpuni ili nikakvi.
--
-- Propust u 0019, 0021 i 0023: funkcije su preskakale retke koje ne smiju
-- dirati (odigrana utakmica, utakmica koja je pocela), a ostale su UPISIVALE i
-- transakcija bi se potvrdila. Klijent je poslije usporedivao broj i bacao
-- gresku — ali prekasno: baza je vec bila promijenjena, a poruka o gresci
-- lazno je sugerirala da se nista nije dogodilo.
--
-- Provjera mora biti UNUTAR baze, jer samo ondje `raise` ponisti transakciju.
-- Sada se broj promijenjenih redaka usporeduje s brojem poslanih i, ako se ne
-- poklapa, sve se vraca na staro.
--
-- Idempotentno: `create or replace`.

-- ── Zdrijeb ────────────────────────────────────────────────────────────────
create or replace function public.set_team_groups(p_changes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_requested integer := jsonb_array_length(p_changes);
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  with changes as (
    select * from jsonb_to_recordset(p_changes) as x(id uuid, group_id uuid)
  )
  update public.team t
     set group_id = c.group_id
    from changes c
   where t.id = c.id;

  get diagnostics v_count = row_count;
  if v_count <> v_requested then
    raise exception 'partial_write: promijenjeno % od % ekipa', v_count, v_requested
      using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

-- ── Zavrsnica ──────────────────────────────────────────────────────────────
create or replace function public.set_knockout_teams(p_changes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_requested integer := jsonb_array_length(p_changes);
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  with changes as (
    select * from jsonb_to_recordset(p_changes)
      as x(id uuid, home_team_id uuid, away_team_id uuid)
  )
  update public.match m
     set home_team_id = c.home_team_id,
         away_team_id = c.away_team_id
    from changes c
   where m.id = c.id
     and m.status = 'scheduled'
     and m.stage in ('semifinal', 'third_place', 'final');

  get diagnostics v_count = row_count;
  -- Odbijen redak znaci da je utakmica u meduvremenu pocela. Tada se NE smije
  -- upisati ni ostale — inace bi pola bracketa bilo po novom, pola po starom.
  if v_count <> v_requested then
    raise exception 'partial_write: postavljeno % od % utakmica zavrsnice', v_count, v_requested
      using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

-- ── Satnica ────────────────────────────────────────────────────────────────
create or replace function public.set_match_slots(p_changes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_requested integer := jsonb_array_length(p_changes);
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  with changes as (
    select * from jsonb_to_recordset(p_changes)
      as x(id uuid, scheduled_time timestamptz, sort_order integer)
  )
  update public.match m
     set scheduled_time = coalesce(c.scheduled_time, m.scheduled_time),
         sort_order     = coalesce(c.sort_order, m.sort_order)
    from changes c
   where m.id = c.id
     and m.status <> 'finished';

  get diagnostics v_count = row_count;
  -- Zamjena termina salje dva retka. Prode li samo jedan, dvije utakmice
  -- zavrse u istom terminu — zato se tada ponistava sve.
  if v_count <> v_requested then
    raise exception 'partial_write: pomaknuto % od % utakmica', v_count, v_requested
      using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;
