-- 0022_team_contact_private.sql — e-mail predstavnika van javne tablice.
--
-- `team` je javno čitljiva jer aplikacija gledateljima prikazuje ekipe. Stupac
-- `rep_email` je zato bio dohvatljiv SVIMA s anonimnim ključem — a taj je ključ
-- ugrađen u objavljenu aplikaciju i u web bundle. Provjereno: običan GET na
-- /rest/v1/team?select=name,rep_email vraćao je adrese.
--
-- RLS štiti RETKE, ne stupce, pa se ovo ne može riješiti politikom nad `team`.
-- Oduzimanje prava na stupac (`revoke select (rep_email)`) također ne prolazi:
-- aplikacija čita `select('*')`, pa bi joj upit počeo pucati.
--
-- Zato adresa seli u zasebnu tablicu koju čita samo organizacija. Podaci se
-- PRESELE, ne brišu.
--
-- Idempotentno: drugi pokretanje ne radi ništa jer stupca više nema.

create table if not exists public.team_contact (
  team_id    uuid primary key references public.team(id) on delete cascade,
  rep_email  text,
  updated_at timestamptz not null default now()
);

comment on table public.team_contact is
  'Kontakt predstavnika ekipe. Odvojeno od `team` jer je `team` javno citljiv.';

-- Preseli postojece adrese, pa ukloni stupac iz javne tablice.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'team' and column_name = 'rep_email'
  ) then
    insert into public.team_contact (team_id, rep_email)
    select id, rep_email from public.team where rep_email is not null
    on conflict (team_id) do update set rep_email = excluded.rep_email;

    alter table public.team drop column rep_email;
  end if;
end $$;

alter table public.team_contact enable row level security;

-- Samo organizacija. Predstavnik svoju adresu zna i bez ovoga, a gledatelju
-- ne treba nikad.
drop policy if exists team_contact_admin on public.team_contact;
create policy team_contact_admin on public.team_contact
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Anonimni nemaju nikakvu politiku, dakle ni pristup.
