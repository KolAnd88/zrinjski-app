-- 0023_set_match_slots.sql — satnica se mijenja u jednom komadu.
--
-- Dosad su i zamjena termina i pomak zbog kašnjenja pisali red po red, kroz
-- `Promise.all` nezavisnih UPDATE-ova. Dva problema:
--
--  1. NIJE ATOMSKI. Pomak zbog kašnjenja dira sve kasnije utakmice tog dana —
--     zna ih biti deset i više. Ako veza pukne na pola, dio utakmica ima novo
--     vrijeme a dio staro, i satnica je u stanju u kojem nikad nije smjela biti.
--     Zamjena termina je još gora: prođe li samo jedan od dva reda, dvije
--     utakmice završe u istom terminu.
--
--  2. RLS TIHO "USPIJE". `update` bez `select` ne vraća grešku kad politika ne
--     da nijedan red — sučelje javi uspjeh, a ništa se nije promijenilo. Ista
--     zamka koja je već popravljena kod poništavanja gola.
--
-- Funkcija vraća broj promijenjenih redova, pa pozivatelj može usporediti s
-- onim što je poslao i prepoznati da promjena nije prošla.
--
-- Odigrane utakmice se NE pomiču — zaštita je i ovdje, ne samo u sučelju.
--
-- Idempotentno: `create or replace`.

create or replace function public.set_match_slots(p_changes jsonb)
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

  -- `coalesce` znaci: sto nije poslano, ostaje kako jest. Zamjena termina
  -- salje i vrijeme i redoslijed, pomak zbog kasnjenja samo vrijeme.
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
  return v_count;
end;
$$;

comment on function public.set_match_slots(jsonb) is
  'Promijeni termin i/ili redoslijed vise utakmica u jednoj transakciji. Ulaz: [{"id":uuid,"scheduled_time":timestamptz|null,"sort_order":int|null}, ...]. Odigrane se ne diraju. Vraca broj promijenjenih.';

grant execute on function public.set_match_slots(jsonb) to authenticated;
