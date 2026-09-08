-- 0035_match_squad.sql — sastav za pojedinu utakmicu.
--
-- Do sada su igraci pripadali samo ekipi, pa je zapisnik ispisivao SVE igrace
-- ekipe. Na turniru se to razilazi sa stvarnoscu vec drugi dan: netko se
-- ozlijedi, netko dode tek u subotu, netko odigra samo jednu utakmicu.
--
-- Zato sastav po utakmici. Prazan sastav znaci "cijela ekipa" — tako se nista
-- ne lomi ako ga nitko ne posloži, a zapisnik ostaje kakav je i bio.

create table if not exists public.match_player (
  match_id  uuid not null references public.match(id)  on delete cascade,
  player_id uuid not null references public.player(id) on delete cascade,
  primary key (match_id, player_id)
);

comment on table public.match_player is
  'Tko je na zapisniku za tu utakmicu. Prazno = cijela ekipa.';

-- Zapisnik i gledateljska aplikacija citaju sastav, pa ide uz ostale javne
-- tablice; pisanje ostaje organizaciji.
alter table public.match_player enable row level security;

drop policy if exists match_player_read on public.match_player;
create policy match_player_read on public.match_player
  for select using (true);

drop policy if exists match_player_write on public.match_player;
create policy match_player_write on public.match_player
  for all using (public.is_admin()) with check (public.is_admin());

/**
 * Sastav se zakljucava kad utakmica krene.
 *
 * U BAZI, ne u sucelju. Sucelje koje sakrije gumb nije zakljucavanje — ostaje
 * otvoreno svakome tko posalje zahtjev izravno, a i sam admin moze imati
 * otvoren stari ekran iz vremena prije pocetka utakmice.
 *
 * Granica je `scheduled`: dok utakmica ceka, sastav se slaze; cim je `live`
 * ili `finished`, zapisnik je zatvoren. To je i pravilo natjecanja, ne samo
 * tehnicko ogranicenje.
 */
create or replace function public.guard_match_squad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match uuid := coalesce(new.match_id, old.match_id);
  v_status public.match_status;
begin
  select status into v_status from public.match where id = v_match;
  if v_status is not null and v_status <> 'scheduled' then
    raise exception using
      errcode = 'P0001',
      message = 'squad_locked';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_match_squad_guard on public.match_player;
create trigger trg_match_squad_guard
  before insert or update or delete on public.match_player
  for each row execute function public.guard_match_squad();

/**
 * Postavi cijeli sastav odjednom.
 *
 * Zamjena ide kao jedna transakcija, ne kao niz pojedinacnih upisa: delegat
 * to radi s telefona u dvorani, gdje veza zna pasti nasred posla. Polovicno
 * spremljen sastav bio bi gori od nikakvog.
 *
 * Prazno polje brise sastav i vraca znacenje "cijela ekipa".
 */
create or replace function public.set_match_squad(
  p_match_id  uuid,
  p_team_id   uuid,
  p_player_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.match_status;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'insufficient_privilege';
  end if;

  select status into v_status from public.match where id = p_match_id;
  if v_status is null then
    raise exception using errcode = 'P0001', message = 'match_not_found';
  end if;
  if v_status <> 'scheduled' then
    raise exception using errcode = 'P0001', message = 'squad_locked';
  end if;

  -- Igrac mora biti iz te ekipe. Bez ovoga bi se pogreskom u sucelju na
  -- zapisnik mogao naci igrac protivnika.
  if exists (
    select 1 from unnest(p_player_ids) as pid
    where not exists (
      select 1 from public.player p where p.id = pid and p.team_id = p_team_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'player_not_in_team';
  end if;

  -- Brise se samo sastav TE ekipe; protivnikov ostaje netaknut.
  delete from public.match_player mp
  using public.player p
  where mp.match_id = p_match_id
    and p.id = mp.player_id
    and p.team_id = p_team_id;

  insert into public.match_player (match_id, player_id)
  select p_match_id, pid from unnest(p_player_ids) as pid
  on conflict do nothing;
end;
$$;

revoke all on function public.set_match_squad(uuid, uuid, uuid[]) from public;
grant execute on function public.set_match_squad(uuid, uuid, uuid[]) to authenticated;

comment on function public.set_match_squad is
  'Zamijeni sastav jedne ekipe za jednu utakmicu. Prazno polje = cijela ekipa.';
