-- 0021_set_knockout_teams.sql — postavljanje ekipa u završnicu.
--
-- Bracket se dosad samo crtao: aplikacija je RAČUNALA tko ide u polufinale,
-- ali to nitko nije zapisivao. Polufinale je ostajalo "A1 vs B2", pa ga
-- zapisničar nije mogao voditi — utakmica nema ekipa ni sastava. Turnir se
-- nije mogao odigrati do kraja.
--
-- Zašto funkcija, a ne obični UPDATE po retku: postavljaju se dvije do četiri
-- utakmice odjednom. Da polovica prođe, bracket bi ostao nedosljedan usred
-- turnira. Jedna transakcija znači: sve ili ništa.
--
-- Zaštita je i ovdje, ne samo u sučelju: utakmica koja je počela ili je
-- odigrana NE SMIJE promijeniti ekipe — inače bi upisani golovi ostali na
-- krivim ekipama.
--
-- Idempotentno: `create or replace`.

create or replace function public.set_knockout_teams(p_changes jsonb)
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

  with changes as (
    select * from jsonb_to_recordset(p_changes)
      as x(id uuid, home_team_id uuid, away_team_id uuid)
  )
  update public.match m
     set home_team_id = c.home_team_id,
         away_team_id = c.away_team_id
    from changes c
   where m.id = c.id
     -- Samo najavljene utakmice zavrsnice. Grupne se ne diraju ovim putem.
     and m.status = 'scheduled'
     and m.stage in ('semifinal', 'third_place', 'final');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.set_knockout_teams(jsonb) is
  'Postavi ekipe u zavrsnicu u jednoj transakciji. Ulaz: [{"id":uuid,"home_team_id":uuid,"away_team_id":uuid}, ...]. Dira samo najavljene utakmice zavrsnice. Vraca broj promijenjenih.';

grant execute on function public.set_knockout_teams(jsonb) to authenticated;
