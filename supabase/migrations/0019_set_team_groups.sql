-- 0019_set_team_groups.sql — ždrijeb se sprema u jednom komadu.
--
-- Admin je ždrijeb spremao red po red, jednim PATCH-om po ekipi. Ako bi treći
-- upis pukao, prva dva bi ostala promijenjena u bazi iako sučelje javi grešku
-- — turnir bi tiho ostao s polovičnim ždrijebom. Jedna funkcija znači jednu
-- transakciju: ili prođu sve ekipe ili nijedna.
--
-- Idempotentno: `create or replace`, smije se pokrenuti više puta.

create or replace function public.set_team_groups(p_changes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Ovlasti se provjeravaju ovdje jer `security definer` zaobilazi RLS.
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Jedan UPDATE za sve ekipe. `from jsonb_to_recordset` je jedini nacin da
  -- se vise redaka promijeni odjednom, a da ostane u istoj transakciji.
  with changes as (
    select * from jsonb_to_recordset(p_changes) as x(id uuid, group_id uuid)
  )
  update public.team t
     set group_id = c.group_id
    from changes c
   where t.id = c.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.set_team_groups(jsonb) is
  'Spremi zdrijeb u jednoj transakciji. Ulaz: [{"id":uuid,"group_id":uuid|null}, ...]. Vraca broj promijenjenih ekipa.';

-- Samo prijavljeni; sama funkcija zatim trazi ulogu admin/delegate.
grant execute on function public.set_team_groups(jsonb) to authenticated;
