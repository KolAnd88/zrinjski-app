# baza.md — Shema baze (Supabase / Postgres)

Prijedlog sheme. Claude Code neka iz ovoga napravi SQL migracije + RLS politike + generira TS tipove. Sve je jedan turnir s više dana; spol (`gender`) razdvaja mušku/žensku konkurenciju. Imena u snake_case.

## Enumi
- `gender`: `m` | `z`
- `stage`: `group` | `semifinal` | `third_place` | `final`
- `match_status`: `scheduled` | `live` | `finished`
- `event_type`: `goal` | `save` | `red_card` | `suspension_2min`
- `sponsor_tier`: `gold` | `silver` | `bronze` | `partner`
- `location_type`: `hall` | `tent` | `dinner` | `hotel` | `other`
- `registration_status`: `pending` | `approved` | `rejected`
- `notification_type`: `team_playing_soon` | `team_goal` | `match_end` | `schedule_change` | `program`

## Tablice

### tournament
Jedinstvene postavke turnira (jedan red za sad, ali ostavi tablicu radi konfiguracije).
- `id` uuid pk
- `name` text  (npr. "VHMRK Zrinjski Cup")
- `season_year` int
- `match_duration_min` int default 15      -- trajanje (konfigurabilno)
- `gap_min` int default 5                  -- razmak između utakmica
- `points_win` int default 2, `points_draw` int default 1, `points_loss` int default 0
- `advance_per_group` int default 2        -- koliko prolazi iz grupe
- `created_at`, `updated_at`

### day  (DANI TURNIRA — dodaju se preko kalendara)
- `id` uuid pk
- `tournament_id` fk
- `date` date            -- iz kalendara; dan u tjednu se računa iz datuma
- `first_match_time` time null   -- početak prve utakmice (zaseban po danu; null = samo program/druženje)
- `sort_order` int

### team
- `id` uuid pk
- `tournament_id` fk
- `name` text
- `short_code` text          -- 3 slova za grb (ZRI, GRU…)
- `color` text               -- hex boje ekipe (za grb)
- `gender` gender
- `group_id` fk null         -- u kojoj je grupi
- `coach_name` text null
- `rep_email` text null      -- e-mail predstavnika
- `logo_url` text null
- `created_at`

### grp  (grupa)  — naziv "group" je rezerviran, koristi "grp"
- `id` uuid pk
- `tournament_id` fk
- `gender` gender
- `name` text                -- "Grupa A"
- `sort_order` int

### player
- `id` uuid pk
- `team_id` fk
- `number` int null
- `name` text
- `is_captain` bool default false
- `sort_order` int

### match
- `id` uuid pk
- `tournament_id` fk
- `day_id` fk null
- `gender` gender
- `stage` stage
- `grp_id` fk null               -- za grupne utakmice
- `home_team_id` fk null         -- null dok se ne zna (npr. "Pobjednik PF1")
- `away_team_id` fk null
- `home_placeholder` text null   -- npr. "Pobjednik PF1"
- `away_placeholder` text null
- `home_score` int default 0
- `away_score` int default 0
- `scheduled_time` timestamptz null   -- iz auto-satnice; uredivo
- `status` match_status default 'scheduled'
- `sort_order` int                    -- redoslijed igranja
- `best_player_id` fk null            -- "najbolji igrač" (ručno, opcionalno po utakmici)
- `current_minute` int null           -- za live prikaz
- `current_half` int null

### match_event   (tijek uživo; iz ovoga se agregira statistika)
- `id` uuid pk
- `match_id` fk
- `team_id` fk
- `player_id` fk null
- `type` event_type
- `minute` int
- `created_at` timestamptz default now()
- (gol => povećava odgovarajući score na match; obrada može biti u app logici ili triggeru)

### sponsor
- `id` uuid pk
- `tournament_id` fk
- `name` text
- `tier` sponsor_tier
- `logo_url` text null
- `is_active` bool default true     -- prekidač (npr. prikaz zlatnog)
- `sort_order` int

### location
- `id` uuid pk
- `tournament_id` fk
- `type` location_type
- `name` text
- `description` text null
- `lat` double precision null
- `lng` double precision null       -- za "Karta" → deep-link navigacija
- `sort_order` int

### program_item   (društveni program: večere, dodjela, druženje)
- `id` uuid pk
- `tournament_id` fk
- `day_id` fk
- `time` time
- `title` text
- `location_id` fk null
- `sort_order` int

### registration   (prijave ekipa na odobravanje)
- `id` uuid pk
- `tournament_id` fk
- `team_name` text
- `gender` gender
- `rep_name` text
- `rep_email` text
- `player_count` int
- `status` registration_status default 'pending'
- `created_at`

### gallery_photo
- `id` uuid pk
- `tournament_id` fk
- `day_id` fk null
- `storage_path` text       -- Supabase Storage
- `created_at`

### app_user   (admin/delegat; korisnici-gledatelji ne trebaju račun)
- `id` uuid pk (= auth.users.id)
- `email` text
- `role` text   -- 'admin' | 'delegate' | 'rep'
- `team_id` fk null   -- ako je predstavnik

### notification_log
- `id` uuid pk
- `tournament_id` fk
- `type` notification_type
- `audience` text       -- 'all' | 'team:<id>' | 'followers:<team_id>'
- `title` text, `body` text
- `sent_at` timestamptz default now()

### device   (za push; prati i preferencije obavijesti)
- `id` uuid pk
- `expo_push_token` text
- `language` text default 'hr'
- `followed_team_ids` uuid[]            -- praćene ekipe (više njih)
- `prefs` jsonb                          -- { team_playing_soon: true, team_goal: true, match_end: true, schedule_change: true, program: false }
- `created_at`, `updated_at`

## RLS (Row Level Security) — smjernice
- **Javno čitanje (anon):** tournament, day, team, grp, player, match, match_event, sponsor, location, program_item, gallery_photo. (Gledatelji bez logina vide sve.)
- **Pisanje:** samo `app_user` s role `admin`/`delegate` (preko auth). `rep` smije uređivati samo svoju ekipu/igrače (`team_id`).
- **registration:** anon smije INSERT (prijava ekipe), čitanje/odobravanje samo admin.
- **device:** vlasnik (po anon ključu/uređaju) smije upsert svoj red; bez čitanja tuđih.
- **notification_log:** čitanje admin; pisanje admin/servis.

## Realtime
- Uključi realtime na `match`, `match_event` (uživo rezultat i tijek se moraju vidjeti odmah na korisničkim uređajima).
- Po potrebi i `sponsor`, `program_item` (rjeđe se mijenjaju).

## Domenska logika (u packages/core, ne u bazi nužno)
- **Auto-satnica:** iz `day.first_match_time` + `tournament.match_duration_min` + `gap_min` + redoslijeda (`match.sort_order`) izračunaj `scheduled_time` za sve utakmice tog dana. Kašnjenje → pomak svih kasnijih + zapiši `notification_log(schedule_change)`.
- **Ljestvica:** agregiraj iz `match` (status finished) po grupi: bodovi (2/1/0), gol-razlika, postignuti golovi → sortiraj → prve `advance_per_group` prolaze.
- **Statistika:** agregiraj `match_event` po `type` i `player_id` (golovi→strijelci, obrane→vratari, isključenja, crveni), odvojeno po `gender`.
