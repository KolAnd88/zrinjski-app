-- 0036_finals_and_schedule.sql — završnica po konkurenciji + ručna satnica.
--
-- ZAVRŠNICA
-- Dosad je završnica bila zakucana: dvije grupe, polufinala, finale i 3.
-- mjesto, jednako za obje konkurencije. Ženska konkurencija igra drukčije —
-- tri grupe, prolazi samo prva, pa završna skupina svaki sa svakim — a klub
-- želi i ubuduće mijenjati način samo kroz admin.
--
--   • finals_config  — postavke završnice, jedan redak po konkurenciji;
--   • match.finals_slot — stabilna oznaka utakmice završnice ('sf1', 'final',
--     'fg2'…). Završna skupina ima fazu 'group' i grp_id = null, pa je
--     starije verzije aplikacije prikažu u rasporedu, a ne kao praznu tablicu;
--   • sync_finals_matches — uskladi utakmice završnice s postavkama.
--
-- SATNICA
--   • program_item.is_pause / duration_min — pauza u dvorani (otvaranje,
--     ručak). Gledatelji je vide u rasporedu, a utakmica u nju ne smije ući;
--   • set_match_times — ručni termin i/ili premještanje u drugi dan, s
--     provjerom razmaka na JEDNOM terenu i pauza.
--
-- Idempotentno: smije se pokrenuti više puta.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Postavke završnice
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.finals_config (
  tournament_id     uuid          not null references public.tournament(id) on delete cascade,
  gender            public.gender not null,
  format            text          not null default 'bracket' check (format in ('bracket', 'group')),
  advance_per_group int           not null default 2 check (advance_per_group between 1 and 8),
  lucky_losers      int           not null default 0 check (lucky_losers between 0 and 8),
  third_place       boolean       not null default true,
  bye_rule          text          not null default 'seed' check (bye_rule in ('seed', 'draw')),
  rematch_rule      text          not null default 'replay' check (rematch_rule in ('replay', 'carry')),
  updated_at        timestamptz   not null default now(),
  primary key (tournament_id, gender)
);

comment on table public.finals_config is
  'Nacin zavrsnice po konkurenciji: kostur (polufinala/finale) ili zavrsna skupina, koliko prolazi, lucky loser, 3. mjesto, slobodan prolaz, ponovni susret.';

drop trigger if exists trg_finals_config_updated on public.finals_config;
create trigger trg_finals_config_updated
  before update on public.finals_config
  for each row execute function public.set_updated_at();

alter table public.finals_config enable row level security;

drop policy if exists finals_config_read on public.finals_config;
create policy finals_config_read on public.finals_config
  for select using (true);

drop policy if exists finals_config_admin_write on public.finals_config;
create policy finals_config_admin_write on public.finals_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.finals_config to anon, authenticated;
grant insert, update, delete on public.finals_config to authenticated;

-- Aplikacija ponovno ucita podatke kad organizator promijeni nacin.
do $$
begin
  alter publication supabase_realtime add table public.finals_config;
exception when duplicate_object then null;
end $$;

-- Pocetne postavke za postojeci turnir.
--   Muski: kao dosad — prve dvije, polufinala i finale; 3. mjesto ako ta
--   utakmica vec postoji.
--   Zenski: tri grupe → zavrsna skupina pobjednica; inace kao muski.
insert into public.finals_config (tournament_id, gender, format, advance_per_group, third_place)
select t.id, 'm', 'bracket', t.advance_per_group,
       exists (select 1 from public.match m
                where m.tournament_id = t.id and m.gender = 'm' and m.stage = 'third_place')
  from public.tournament t
on conflict do nothing;

insert into public.finals_config (tournament_id, gender, format, advance_per_group, third_place)
select t.id, 'z',
       case when g.n = 3 then 'group' else 'bracket' end,
       case when g.n = 3 then 1 else t.advance_per_group end,
       g.n <> 3
  from public.tournament t
  cross join lateral (
    select count(*)::int as n from public.grp where tournament_id = t.id and gender = 'z'
  ) g
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Oznaka utakmice završnice
-- ════════════════════════════════════════════════════════════════════════════

alter table public.match add column if not exists finals_slot text;

comment on column public.match.finals_slot is
  'Mjesto u zavrsnici: sf1, sf2, third, final, fg1…fgN (zavrsna skupina). Null = obicna grupna utakmica.';

-- Postojece utakmice zavrsnice dobivaju oznake: polufinala redom igranja,
-- pa 3. mjesto i finale. Visak (dvostruko finale) ostaje bez oznake.
with s as (
  select id, row_number() over (partition by tournament_id, gender order by sort_order, id) as rn
    from public.match
   where stage = 'semifinal' and finals_slot is null
)
update public.match m set finals_slot = 'sf' || s.rn
  from s where m.id = s.id and s.rn <= 2;

with s as (
  select id, row_number() over (partition by tournament_id, gender order by sort_order, id) as rn
    from public.match where stage = 'third_place' and finals_slot is null
)
update public.match m set finals_slot = 'third' from s where m.id = s.id and s.rn = 1;

with s as (
  select id, row_number() over (partition by tournament_id, gender order by sort_order, id) as rn
    from public.match where stage = 'final' and finals_slot is null
)
update public.match m set finals_slot = 'final' from s where m.id = s.id and s.rn = 1;

create unique index if not exists uq_match_finals_slot
  on public.match (tournament_id, gender, finals_slot)
  where finals_slot is not null;

-- Muski se igra B1–A2, ne A2–B1. Samo dok ekipe nisu upisane.
update public.match
   set home_placeholder = 'B1', away_placeholder = 'A2'
 where finals_slot = 'sf2'
   and home_placeholder = 'A2' and away_placeholder = 'B1'
   and home_team_id is null and away_team_id is null
   and status = 'scheduled';

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Uskladivanje utakmica završnice s postavkama
-- ════════════════════════════════════════════════════════════════════════════
--
-- Popis mjesta racuna aplikacija (ista logika koja ih i prikazuje), a baza ih
-- upisuje pod bravom: dva organizatora istodobno ne mogu napraviti dvostruku
-- zavrsnicu. Kad je zavrsnica pocela, nista se ne mijenja — to bi prepisalo
-- rezultate na krive ekipe.
--
-- Postojece mjesto zadrzava svoju utakmicu (termin, dan); promijeni li mu se
-- oznaka, ekipe se brisu jer vise ne odgovaraju. Mjesta kojih vise nema se
-- brisu, nova se dodaju na kraj zadanog dana, bez termina.

create or replace function public.sync_finals_matches(
  p_tournament_id uuid,
  p_gender text,
  p_day_id uuid,
  p_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender  public.gender := p_gender::public.gender;
  v_order   integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_deleted integer := 0;
  s record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tournament_id::text || p_gender));

  if exists (
    select 1 from public.match
     where tournament_id = p_tournament_id and gender = v_gender
       and finals_slot is not null and status <> 'scheduled'
  ) then
    raise exception 'finals_started' using errcode = 'P0001';
  end if;

  delete from public.match m
   where m.tournament_id = p_tournament_id and m.gender = v_gender
     and m.finals_slot is not null
     and not exists (
       select 1 from jsonb_array_elements(p_slots) e where e->>'key' = m.finals_slot
     );
  get diagnostics v_deleted = row_count;

  select coalesce(max(sort_order), -1) + 1 into v_order
    from public.match where tournament_id = p_tournament_id;

  for s in
    select * from jsonb_to_recordset(p_slots) as x(key text, stage text, home text, away text)
  loop
    if exists (
      select 1 from public.match
       where tournament_id = p_tournament_id and gender = v_gender and finals_slot = s.key
    ) then
      update public.match m
         set stage            = s.stage::public.stage,
             grp_id           = null,
             home_placeholder = s.home,
             away_placeholder = s.away,
             home_team_id     = case when m.home_placeholder is distinct from s.home
                                       or m.stage::text <> s.stage then null else m.home_team_id end,
             away_team_id     = case when m.away_placeholder is distinct from s.away
                                       or m.stage::text <> s.stage then null else m.away_team_id end
       where m.tournament_id = p_tournament_id and m.gender = v_gender and m.finals_slot = s.key
         and (m.stage::text <> s.stage
              or m.grp_id is not null
              or m.home_placeholder is distinct from s.home
              or m.away_placeholder is distinct from s.away);
      if found then v_updated := v_updated + 1; end if;
    else
      insert into public.match (
        tournament_id, gender, stage, grp_id, finals_slot,
        home_placeholder, away_placeholder, day_id, sort_order
      ) values (
        p_tournament_id, v_gender, s.stage::public.stage, null, s.key,
        s.home, s.away, p_day_id, v_order
      );
      v_order := v_order + 1;
      v_created := v_created + 1;
    end if;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'deleted', v_deleted);
end;
$$;

comment on function public.sync_finals_matches(uuid, text, uuid, jsonb) is
  'Uskladi utakmice zavrsnice jedne konkurencije s postavkama. Ulaz: [{"key","stage","home","away"}]. Odbija kad je zavrsnica pocela.';

revoke all on function public.sync_finals_matches(uuid, text, uuid, jsonb) from public;
grant execute on function public.sync_finals_matches(uuid, text, uuid, jsonb) to authenticated;

-- Stari nacin pravio je polufinala i finale uvijek, za obje konkurencije.
-- Otvorena kartica starog admina mogla bi zenskoj konkurenciji napraviti
-- polufinala koja se ne igraju — zato vise ne radi nista.
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
begin
  raise exception 'deprecated: osvjezi admin stranicu (zavrsnica se sada uskladuje prema postavkama)'
    using errcode = 'P0001';
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Upis ekipa u završnicu — i u završnu skupinu
-- ════════════════════════════════════════════════════════════════════════════

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
     -- Zavrsnica u svakom obliku; obicne grupne utakmice se ovim putem ne diraju.
     and (m.finals_slot is not null or m.stage in ('semifinal', 'third_place', 'final'))
     -- Ekipa mora biti iz iste konkurencije.
     and (c.home_team_id is null or exists (
           select 1 from public.team t where t.id = c.home_team_id and t.gender = m.gender))
     and (c.away_team_id is null or exists (
           select 1 from public.team t where t.id = c.away_team_id and t.gender = m.gender))
     and (c.home_team_id is null or c.home_team_id is distinct from c.away_team_id);

  get diagnostics v_count = row_count;
  -- Odbijen redak: utakmica je u meduvremenu pocela ili je ekipa kriva. Tada
  -- se NE smije upisati ni ostalo — pola zavrsnice po novom, pola po starom.
  if v_count <> v_requested then
    raise exception 'partial_write: postavljeno % od % utakmica zavrsnice', v_count, v_requested
      using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Pauza u dvorani
-- ════════════════════════════════════════════════════════════════════════════

alter table public.program_item add column if not exists is_pause boolean not null default false;
alter table public.program_item add column if not exists duration_min int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'program_item_pause_duration') then
    alter table public.program_item
      add constraint program_item_pause_duration
      check (not is_pause or (duration_min is not null and duration_min > 0 and duration_min <= 600));
  end if;
end $$;

comment on column public.program_item.is_pause is
  'Pauza u dvorani (otvaranje, rucak): u njoj se ne igra. Obican program (vecera) ne blokira teren.';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Ručni termin utakmice
-- ════════════════════════════════════════════════════════════════════════════
--
-- Igra se na JEDNOM terenu: izmedu pocetaka bilo koje dvije utakmice istog
-- dana mora proci barem trajanje + razmak, i nijedna ne smije uci u pauzu.
-- Provjerava se samo ono sto se ovim pozivom mijenja — stara satnica s
-- drugacijim trajanjem ne smije blokirati svaku sljedecu izmjenu.
--
-- Sve ili nista: jedna neispravna utakmica ponistava cijeli poziv ("Pomakni i
-- sve iza" salje cijeli lanac odjednom).

create or replace function public.set_match_times(p_changes jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requested integer := jsonb_array_length(p_changes);
  v_count     integer;
  v_tid       uuid;
  v_step      interval;
  v_dur       interval;
  v_ids       uuid[];
  v_bad       record;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_requested = 0 then return 0; end if;

  select array_agg(x.id) into v_ids
    from jsonb_to_recordset(p_changes) as x(id uuid);

  select m.tournament_id into v_tid from public.match m where m.id = v_ids[1];
  select make_interval(mins => t.match_duration_min + t.gap_min),
         make_interval(mins => t.match_duration_min)
    into v_step, v_dur
    from public.tournament t where t.id = v_tid;

  if exists (select 1 from public.match where id = any(v_ids) and tournament_id <> v_tid) then
    raise exception 'mixed_tournaments' using errcode = 'P0001';
  end if;

  with changes as (
    select * from jsonb_to_recordset(p_changes)
      as x(id uuid, day_id uuid, scheduled_time timestamptz)
  )
  update public.match m
     set day_id = c.day_id,
         scheduled_time = c.scheduled_time
    from changes c
   where m.id = c.id
     and m.status = 'scheduled';

  get diagnostics v_count = row_count;
  if v_count <> v_requested then
    raise exception 'match_locked: % od % utakmica je pocelo ili ne postoji', v_requested - v_count, v_requested
      using errcode = 'P0001';
  end if;

  -- Termin mora biti na datum svog dana (po mjesnom vremenu).
  if exists (
    select 1 from public.match m join public.day d on d.id = m.day_id
     where m.id = any(v_ids) and m.scheduled_time is not null
       and (m.scheduled_time at time zone 'Europe/Sarajevo')::date <> d.date
  ) then
    raise exception 'wrong_day' using errcode = 'P0001';
  end if;

  -- Razmak na jednom terenu.
  select a.id as a_id, b.id as b_id into v_bad
    from public.match a
    join public.match b
      on b.tournament_id = a.tournament_id and b.day_id = a.day_id and b.id <> a.id
   where a.id = any(v_ids)
     and a.scheduled_time is not null and b.scheduled_time is not null
     and abs(extract(epoch from (a.scheduled_time - b.scheduled_time))) < extract(epoch from v_step)
   limit 1;
  if found then
    raise exception 'too_close' using errcode = 'P0001',
      detail = v_bad.a_id::text || ',' || v_bad.b_id::text;
  end if;

  -- Pauze.
  select m.id as m_id, p.title into v_bad
    from public.match m
    join public.day d on d.id = m.day_id
    join public.program_item p on p.day_id = m.day_id and p.is_pause
   where m.id = any(v_ids) and m.scheduled_time is not null
     and tstzrange(m.scheduled_time, m.scheduled_time + v_dur)
         && tstzrange(((d.date + p.time) at time zone 'Europe/Sarajevo'),
                      ((d.date + p.time) at time zone 'Europe/Sarajevo') + make_interval(mins => p.duration_min))
   limit 1;
  if found then
    raise exception 'in_pause' using errcode = 'P0001', detail = v_bad.title;
  end if;

  -- Redoslijed igranja prati sat: admin, generiranje i strelice rade po
  -- sort_order, pa mora biti kronoloski i nakon rucne izmjene.
  with ordered as (
    select m.id,
           row_number() over (
             order by d.date nulls last, m.scheduled_time nulls last, m.sort_order, m.id
           ) - 1 as rn
      from public.match m
      left join public.day d on d.id = m.day_id
     where m.tournament_id = v_tid
  )
  update public.match m set sort_order = o.rn
    from ordered o
   where m.id = o.id and m.sort_order <> o.rn;

  return v_count;
end;
$$;

comment on function public.set_match_times(jsonb) is
  'Rucni termin i dan utakmica u jednoj transakciji. Ulaz: [{"id","day_id","scheduled_time"}]. Provjerava razmak na jednom terenu i pauze.';

revoke all on function public.set_match_times(jsonb) from public;
grant execute on function public.set_match_times(jsonb) to authenticated;
