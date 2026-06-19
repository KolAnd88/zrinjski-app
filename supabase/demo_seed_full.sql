-- demo_seed_full.sql — BOGAT demo za prezentaciju.
-- 12 muških + 12 ženskih ekipa (2 grupe po 6 po spolu). Sve odigrano OSIM finala.
-- Grupe + polufinala + za 3. mjesto = završeno; FINALA = jedina preostala (najavljena).
-- Utakmica = 1×15 min → rezultati su realno niski.
-- Svi ID-evi počinju s '22222222-2222-2222-2222-' → demo_clear.sql ih briše ciljano.
-- Idempotentno (on conflict do nothing). Preporuka: prvo pokreni demo_clear.sql.

do $$
declare
  v_tid uuid;
  base text := '22222222-2222-2222-2222-';
  c int := 0;
  d_soc uuid; d_grp uuid; d_kn uuid;
  colors text[] := array['#E11D2A','#2D6CDF','#6A1FB0','#1F7A8C','#C2410C','#0D9488','#B03060','#0E7490','#9C0C18','#2D6CDF','#1F7A8C','#C2410C'];
  fnames_m text[] := array['Marko','Ivan','Josip','Luka','Petar','Ante','Tomo','Mate','Stipe','Dario','Goran','Damir'];
  fnames_z text[] := array['Maja','Ana','Iva','Petra','Sara','Marija','Lucija','Nina','Ela','Mia','Tea','Dora'];
  lnames text[] := array['Jurić','Babić','Marić','Bevanda','Soldo','Kovač','Lulić','Pavić','Vidović','Lučić','Galić','Boban'];
  grp_names text[];
  grp_codes text[];
  gid uuid;
  tids uuid[];
  mA uuid[]; mB uuid[]; zA uuid[]; zB uuid[];
  gi int; ti int; i int; j int;
  gen text; gletter text;
  tid uuid; pid uuid; mid uuid;
  hs int; aw int;
  gm int := 0;   -- brojač grupnih termina
  -- knockout
  kn_matches uuid[] := '{}';
  kn_home uuid[] := '{}';
  kn_away uuid[] := '{}';
  kn_gh int[] := '{}';
  kn_ga int[] := '{}';
  hp uuid[]; ap uuid[];
  k int; gkeep uuid;
begin
  select id into v_tid from public.tournament order by created_at limit 1;
  if v_tid is null then
    insert into public.tournament (name, season_year) values ('VHMRK Zrinjski Cup', 2026) returning id into v_tid;
  end if;

  -- DANI
  d_soc := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
  d_grp := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
  d_kn  := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
  insert into public.day (id, tournament_id, date, first_match_time, sort_order) values
   (d_soc, v_tid, '2026-06-05', null, 0),
   (d_grp, v_tid, '2026-06-06', '10:00', 1),
   (d_kn,  v_tid, '2026-06-07', '17:00', 2)
  on conflict (id) do nothing;

  -- 4 GRUPE (M-A, M-B, Ž-A, Ž-B) sa 6 ekipa + igrači
  for gi in 1..4 loop
    if gi=1 then gen:='m'; gletter:='Grupa A'; grp_names:=array['VHMRK Zrinjski','Grude Legende','Izviđač','Posušje veterani','Čapljina','Široki Brijeg']; grp_codes:=array['ZRI','GRU','IZV','POS','CAP','SIR'];
    elsif gi=2 then gen:='m'; gletter:='Grupa B'; grp_names:=array['Ljubuški','Čitluk','Stolac','Neum','Tomislavgrad','Livno']; grp_codes:=array['LJU','CIT','STO','NEU','TOM','LIV'];
    elsif gi=3 then gen:='z'; gletter:='Grupa A'; grp_names:=array['ŽRK Lasta','Mostar Ž','Hercegovac Ž','Zrinjski Ž','Grude Ž','Široki Ž']; grp_codes:=array['LAS','MOS','HER','ZRZ','GRZ','SIZ'];
    else gen:='z'; gletter:='Grupa B'; grp_names:=array['Ljubuški Ž','Čapljina Ž','Posušje Ž','Neum Ž','Livno Ž','Tomislav Ž']; grp_codes:=array['LJZ','CAZ','POZ','NEZ','LIZ','TOZ'];
    end if;

    gid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
    insert into public.grp (id, tournament_id, gender, name, sort_order)
      values (gid, v_tid, gen::public.gender, gletter, gi) on conflict (id) do nothing;

    tids := '{}';
    for ti in 1..6 loop
      tid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
      insert into public.team (id, tournament_id, name, short_code, color, gender, group_id, coach_name, rep_email)
        values (tid, v_tid, grp_names[ti], grp_codes[ti], colors[((ti+gi)%12)+1], gen::public.gender, gid,
                (case when gen='m' then 'Trener '||grp_codes[ti] else 'Trenerica '||grp_codes[ti] end),
                lower(grp_codes[ti])||'@klub.ba')
        on conflict (id) do nothing;
      tids := array_append(tids, tid);
      -- 5 igrača po ekipi
      for i in 1..5 loop
        pid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
        insert into public.player (id, team_id, number, name, is_captain, sort_order)
          values (pid, tid, i,
                  (case when gen='m' then fnames_m[((i+ti)%12)+1] else fnames_z[((i+ti)%12)+1] end)||' '||lnames[((i*ti)%12)+1],
                  (i=1), i-1)
          on conflict (id) do nothing;
      end loop;
    end loop;

    if gi=1 then mA:=tids; elsif gi=2 then mB:=tids; elsif gi=3 then zA:=tids; else zB:=tids; end if;

    -- GRUPA round-robin: niži indeks (jači) je domaćin i pobjeđuje → čist poredak
    for i in 1..6 loop
      for j in i+1..6 loop
        mid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
        hs := 9 + ((i+j) % 4);              -- 9..12
        aw := hs - (1 + ((i*j) % 4));        -- 1..4 manje → domaćin pobjeđuje
        if aw < 0 then aw := 0; end if;
        insert into public.match (id, tournament_id, day_id, gender, stage, grp_id, home_team_id, away_team_id, home_score, away_score, scheduled_time, status, sort_order)
          values (mid, v_tid, d_grp, gen::public.gender, 'group', gid, tids[i], tids[j], hs, aw,
                  ('2026-06-06 10:00:00+02'::timestamptz + ((gm % 24) * interval '20 min')), 'finished', gm)
          on conflict (id) do nothing;
        gm := gm + 1;
      end loop;
    end loop;
  end loop;

  -- ZAVRŠNICA po spolu (m pa z). Polufinala/za-3. ZAVRŠENO (rezultat preko golova),
  -- FINALE NAJAVLJENO (jedina preostala utakmica).
  for gi in 1..2 loop
    declare aT uuid[]; bT uuid[]; sortk int;
    begin
      if gi=1 then gen:='m'; aT:=mA; bT:=mB; sortk:=200; else gen:='z'; aT:=zA; bT:=zB; sortk:=300; end if;

      -- PF1: A1 vs B2 (A1 pobjeđuje), PF2: A2 vs B1 (B1 pobjeđuje)
      mid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
      insert into public.match (id, tournament_id, day_id, gender, stage, home_team_id, away_team_id, home_score, away_score, scheduled_time, status, sort_order)
        values (mid, v_tid, d_kn, gen::public.gender, 'semifinal', aT[1], bT[2], 0, 0, '2026-06-07 17:00:00+02', 'finished', sortk) on conflict (id) do nothing;
      kn_matches:=array_append(kn_matches,mid); kn_home:=array_append(kn_home,aT[1]); kn_away:=array_append(kn_away,bT[2]); kn_gh:=array_append(kn_gh,10); kn_ga:=array_append(kn_ga,8);

      mid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
      insert into public.match (id, tournament_id, day_id, gender, stage, home_team_id, away_team_id, home_score, away_score, scheduled_time, status, sort_order)
        values (mid, v_tid, d_kn, gen::public.gender, 'semifinal', aT[2], bT[1], 0, 0, '2026-06-07 17:30:00+02', 'finished', sortk+1) on conflict (id) do nothing;
      kn_matches:=array_append(kn_matches,mid); kn_home:=array_append(kn_home,aT[2]); kn_away:=array_append(kn_away,bT[1]); kn_gh:=array_append(kn_gh,7); kn_ga:=array_append(kn_ga,9);

      -- ZA 3. MJESTO: poraženi PF1 (B2) vs poraženi PF2 (A2)
      mid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
      insert into public.match (id, tournament_id, day_id, gender, stage, home_team_id, away_team_id, home_score, away_score, scheduled_time, status, sort_order)
        values (mid, v_tid, d_kn, gen::public.gender, 'third_place', bT[2], aT[2], 0, 0, '2026-06-07 18:15:00+02', 'finished', sortk+2) on conflict (id) do nothing;
      kn_matches:=array_append(kn_matches,mid); kn_home:=array_append(kn_home,bT[2]); kn_away:=array_append(kn_away,aT[2]); kn_gh:=array_append(kn_gh,9); kn_ga:=array_append(kn_ga,8);

      -- FINALE: pobjednik PF1 (A1) vs pobjednik PF2 (B1) — NAJAVLJENO (preostalo)
      mid := (base||lpad(to_hex(c),12,'0'))::uuid; c:=c+1;
      insert into public.match (id, tournament_id, day_id, gender, stage, home_team_id, away_team_id, home_score, away_score, scheduled_time, status, sort_order)
        values (mid, v_tid, d_kn, gen::public.gender, 'final', aT[1], bT[1], 0, 0, '2026-06-07 19:00:00+02', 'scheduled', sortk+3) on conflict (id) do nothing;
    end;
  end loop;

  -- DOGAĐAJI za završene knockout utakmice (golovi grade rezultat preko okidača → statistika)
  for k in 1..array_length(kn_matches,1) loop
    select array_agg(id order by sort_order) into hp from public.player where team_id = kn_home[k];
    select array_agg(id order by sort_order) into ap from public.player where team_id = kn_away[k];
    if hp is not null then
      for i in 1..kn_gh[k] loop
        insert into public.match_event (id, match_id, team_id, player_id, type, minute)
          values ((base||lpad(to_hex(c),12,'0'))::uuid, kn_matches[k], kn_home[k], hp[((i-1)%array_length(hp,1))+1], 'goal', ((i-1)%15)+1)
          on conflict (id) do nothing; c:=c+1;
      end loop;
    end if;
    if ap is not null then
      for i in 1..kn_ga[k] loop
        insert into public.match_event (id, match_id, team_id, player_id, type, minute)
          values ((base||lpad(to_hex(c),12,'0'))::uuid, kn_matches[k], kn_away[k], ap[((i-1)%array_length(ap,1))+1], 'goal', ((i-1)%15)+1)
          on conflict (id) do nothing; c:=c+1;
      end loop;
      -- po koja obrana (vratar = igrač 1 gostiju)
      insert into public.match_event (id, match_id, team_id, player_id, type, minute)
        values ((base||lpad(to_hex(c),12,'0'))::uuid, kn_matches[k], kn_away[k], ap[1], 'save', 6)
        on conflict (id) do nothing; c:=c+1;
    end if;
  end loop;

  -- SPONZORI
  insert into public.sponsor (id, tournament_id, name, tier, is_active, sort_order) values
   ((base||lpad(to_hex(c+1),12,'0'))::uuid, v_tid, 'Elektroprivreda HZHB', 'gold', true, 0),
   ((base||lpad(to_hex(c+2),12,'0'))::uuid, v_tid, 'Euroherc', 'silver', true, 1),
   ((base||lpad(to_hex(c+3),12,'0'))::uuid, v_tid, 'HT Eronet', 'silver', true, 2),
   ((base||lpad(to_hex(c+4),12,'0'))::uuid, v_tid, 'JYSK', 'bronze', true, 3),
   ((base||lpad(to_hex(c+5),12,'0'))::uuid, v_tid, 'Konzum', 'partner', true, 4)
  on conflict (id) do nothing; c:=c+5;

  -- LOKACIJE
  insert into public.location (id, tournament_id, type, name, description, lat, lng, sort_order) values
   ((base||lpad(to_hex(c+1),12,'0'))::uuid, v_tid, 'hall', 'Dvorana Bijeli Brijeg', 'Glavna dvorana', 43.337, 17.793, 0),
   ((base||lpad(to_hex(c+2),12,'0'))::uuid, v_tid, 'tent', 'Šator (parking)', 'Druženje ispred dvorane', 43.3372, 17.7932, 1),
   ((base||lpad(to_hex(c+3),12,'0'))::uuid, v_tid, 'dinner', 'Restoran Mostar', 'Završna večera', 43.343, 17.808, 2),
   ((base||lpad(to_hex(c+4),12,'0'))::uuid, v_tid, 'hotel', 'Hotel Mostar', null, 43.341, 17.814, 3),
   ((base||lpad(to_hex(c+5),12,'0'))::uuid, v_tid, 'hotel', 'Hotel Bristol', null, 43.339, 17.81, 4)
  on conflict (id) do nothing; c:=c+5;

  -- PROGRAM
  insert into public.program_item (id, tournament_id, day_id, time, title, sort_order) values
   ((base||lpad(to_hex(c+1),12,'0'))::uuid, v_tid, d_soc, '19:00', 'Dolazak i registracija', 0),
   ((base||lpad(to_hex(c+2),12,'0'))::uuid, v_tid, d_grp, '21:00', 'Druženje uz večeru', 0),
   ((base||lpad(to_hex(c+3),12,'0'))::uuid, v_tid, d_kn,  '20:30', 'Završna večera i dodjela', 0)
  on conflict (id) do nothing; c:=c+3;

  -- PRIJAVE
  insert into public.registration (id, tournament_id, team_name, gender, rep_name, rep_email, player_count, status) values
   ((base||lpad(to_hex(c+1),12,'0'))::uuid, v_tid, 'Mostar SG', 'm', 'Ivan Lučić', 'ivan@msg.ba', 13, 'pending'),
   ((base||lpad(to_hex(c+2),12,'0'))::uuid, v_tid, 'ŽRK Iskra', 'z', 'Maja Kovač', 'maja@iskra.ba', 11, 'pending')
  on conflict (id) do nothing; c:=c+2;
end $$;
