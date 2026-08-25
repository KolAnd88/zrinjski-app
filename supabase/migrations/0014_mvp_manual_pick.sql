-- 0014_mvp_manual_pick.sql — organizator ručno bira najboljeg igrača i igračicu.
--
-- Glasanje predstavnika (0013) ostaje, ali ne može biti jedini put: glasanje
-- se možda nikad ne otvori, ekipe ne stignu glasati, ili organizator jednostavno
-- odluči sam. Zato turnir dobiva dva polja — po jedno za svaku konkurenciju.
--
-- Odnos prema glasanju: RUČNI IZBOR IMA PREDNOST. Ako je upisan, prikazuje se
-- on; ako nije, prikazuje se pobjednik glasanja. Tako organizator ima zadnju
-- riječ, a da glasovi ostanu zabilježeni.
--
-- Sigurno za višekratno pokretanje.

alter table public.tournament
  add column if not exists mvp_m_player_id uuid references public.player(id) on delete set null;

alter table public.tournament
  add column if not exists mvp_z_player_id uuid references public.player(id) on delete set null;

comment on column public.tournament.mvp_m_player_id is
  'Najbolji igrac turnira (muska konkurencija), rucni izbor organizatora.';
comment on column public.tournament.mvp_z_player_id is
  'Najbolja igracica turnira (zenska konkurencija), rucni izbor organizatora.';

-- Pisanje pokriva postojeca politika tournament_admin_write iz 0002 (admin i
-- delegat), a citanje je javno kao i ostatak turnira — nagrada i jest javna.
