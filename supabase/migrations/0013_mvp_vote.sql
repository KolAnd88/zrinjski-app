-- 0013_mvp_vote.sql — najbolji igrač turnira bira se GLASANJEM predstavnika ekipa.
--
-- Zašto glasanje, a ne polje koje admin upiše: najboljeg igrača turnira nitko
-- ne može izmjeriti brojkom. Golman i strijelac se računaju automatski iz
-- match_event (obrane, golovi) i ne trebaju ni tablicu ni ovu migraciju.
--
-- Pravila (dogovoreno):
--   • Glasa samo predstavnik odobrene ekipe (role='rep' i team_id nije null).
--   • Jedan glas po računu, promjenjiv dok je glasanje otvoreno.
--   • NE smije se glasati za igrača vlastite ekipe.
--   • Glasa se samo u vlastitoj konkurenciji (spol se uzima iz ekipe glasača).
--   • Rezultat vide svi TEK kad admin zatvori glasanje; do tada samo admin.
--
-- Sigurno za višekratno pokretanje.

-- ── Prekidač glasanja ──────────────────────────────────────────────────────
-- Zatvoreno je početno stanje: glasanje ima smisla tek pred kraj turnira.
alter table public.tournament
  add column if not exists mvp_voting_open boolean not null default false;

comment on column public.tournament.mvp_voting_open is
  'Dok je true, predstavnici mogu glasati; dok je false, rezultat je javan.';

-- ── Glasovi ────────────────────────────────────────────────────────────────
create table if not exists public.mvp_vote (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid   not null references public.tournament(id) on delete cascade,
  gender        gender not null,
  voter_id      uuid   not null references auth.users(id) on delete cascade,
  voter_team_id uuid   references public.team(id) on delete set null,
  player_id     uuid   not null references public.player(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Jedan račun = jedan glas. Promjena mišljenja mijenja isti red.
  unique (tournament_id, voter_id)
);

create index if not exists idx_mvp_vote_player on public.mvp_vote (player_id);

drop trigger if exists trg_mvp_vote_updated on public.mvp_vote;
create trigger trg_mvp_vote_updated
  before update on public.mvp_vote
  for each row execute function public.set_updated_at();

alter table public.mvp_vote enable row level security;

-- ── Tko što vidi ───────────────────────────────────────────────────────────
-- Glasač vidi isključivo svoj glas — tuđi glasovi nisu njegova stvar, a i da
-- ih vidi, mogao bi prebrojati rezultat prije zatvaranja.
drop policy if exists mvp_vote_own_read on public.mvp_vote;
create policy mvp_vote_own_read
  on public.mvp_vote for select
  to authenticated
  using (voter_id = auth.uid());

drop policy if exists mvp_vote_admin_read on public.mvp_vote;
create policy mvp_vote_admin_read
  on public.mvp_vote for select
  to authenticated
  using (public.is_admin());

-- Pisanje ide ISKLJUČIVO kroz cast_my_mvp_vote(); nema insert/update politike.
-- Bez toga bi predstavnik mogao zaobići provjeru vlastite ekipe običnim upisom.

-- ── Predaja glasa ──────────────────────────────────────────────────────────
create or replace function public.cast_my_mvp_vote(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_team     uuid;
  v_role     text;
  v_t        public.tournament;
  v_pteam    uuid;
  v_pgender  gender;
  v_mygender gender;
begin
  if v_uid is null then
    raise exception 'vote_unauthorized';
  end if;

  select role, team_id into v_role, v_team from public.app_user where id = v_uid;
  if v_role is distinct from 'rep' or v_team is null then
    raise exception 'vote_not_a_rep';
  end if;

  select * into v_t from public.tournament order by created_at limit 1;
  if v_t.id is null or not v_t.mvp_voting_open then
    raise exception 'vote_closed';
  end if;

  select gender into v_mygender from public.team where id = v_team;

  select t.id, t.gender into v_pteam, v_pgender
  from public.player p
  join public.team t on t.id = p.team_id
  where p.id = p_player_id;

  if v_pteam is null then
    raise exception 'vote_no_player';
  end if;
  if v_pteam = v_team then
    raise exception 'vote_own_team';
  end if;
  if v_pgender is distinct from v_mygender then
    raise exception 'vote_other_competition';
  end if;

  insert into public.mvp_vote (tournament_id, gender, voter_id, voter_team_id, player_id)
  values (v_t.id, v_mygender, v_uid, v_team, p_player_id)
  on conflict (tournament_id, voter_id)
  do update set player_id = excluded.player_id, voter_team_id = excluded.voter_team_id;
end;
$$;

-- ── Rezultat ───────────────────────────────────────────────────────────────
-- Vraća samo brojeve glasova, nikad tko je za koga glasao. Dok je glasanje
-- otvoreno, brojke vidi jedino admin — inače bi se predstavnici povodili
-- za trenutnim vodećim.
create or replace function public.mvp_results()
returns table (player_id uuid, gender gender, votes bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_t public.tournament;
begin
  select * into v_t from public.tournament order by created_at limit 1;
  if v_t.id is null then
    return;
  end if;
  if v_t.mvp_voting_open and not public.is_admin() then
    return;
  end if;

  return query
    select v.player_id, v.gender, count(*)::bigint
    from public.mvp_vote v
    where v.tournament_id = v_t.id
    group by v.player_id, v.gender
    order by count(*) desc;
end;
$$;

-- ── Dozvole ────────────────────────────────────────────────────────────────
revoke all on function public.cast_my_mvp_vote(uuid) from public;
grant execute on function public.cast_my_mvp_vote(uuid) to authenticated;

revoke all on function public.mvp_results() from public;
grant execute on function public.mvp_results() to anon, authenticated;

comment on function public.cast_my_mvp_vote is
  'Predstavnik glasa za najboljeg igraca. Jedan glas, ne za vlastitu ekipu.';
comment on function public.mvp_results is
  'Broj glasova po igracu. Javno tek kad admin zatvori glasanje.';

-- Realtime: gledatelji vide nagradu čim admin zatvori glasanje.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'mvp_vote'
  ) then
    alter publication supabase_realtime add table public.mvp_vote;
  end if;
end $$;
