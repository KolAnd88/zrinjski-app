# Spajanje na Supabase — korak po korak

Ovo radiš jednom. Ne treba dijeliti lozinke — SQL pokrećeš sam u svojoj ploči,
a Claudeu daješ samo dva **javna** ključa (URL + anon key).

## 1. Napravi Supabase projekt
1. Idi na https://supabase.com → **Sign in** (može preko GitHub/Google).
2. **New project**.
   - **Name:** `vhmrk-zrinjski`
   - **Database Password:** generiraj jaku lozinku i **spremi je** (zatreba samo ako kasnije koristiš CLI; ne dijeli je).
   - **Region:** `Central EU (Frankfurt)` (najbliže).
3. Pričekaj ~2 min da se projekt napravi.

## 2. Pokreni shemu (kreira sve tablice)
1. U lijevom izborniku: **SQL Editor** → **New query**.
2. Otvori datoteku `supabase/all.sql` iz projekta, kopiraj **cijeli** sadržaj, zalijepi.
3. Klikni **Run** (dolje desno). Treba pisati uspjeh (bez crvenih grešaka).

## 3. Napravi svoj admin korisnik
1. Lijevi izbornik: **Authentication** → **Users** → **Add user** → **Create new user**.
   - Upiši svoj **e-mail** i **lozinku**, uključi **Auto Confirm User**.
2. Natrag u **SQL Editor** → **New query**, zalijepi sadržaj `supabase/make_admin.sql`,
   ali prvo zamijeni `TVOJ@EMAIL.com` e-mailom koji si upisao. **Run**.

## 4. Pokupi ključeve (ovo daješ Claudeu)
1. Lijevi izbornik: **Project Settings** (zupčanik) → **API**.
2. Trebaju dvije stvari:
   - **Project URL** (npr. `https://abcd1234.supabase.co`)
   - **Project API keys → `anon` `public`** (dugi niz)
3. Pošalji ta dva podatka Claudeu. (Oba su javna — anon ključ je predviđen za korištenje u aplikaciji; prava zaštita je RLS koji smo postavili.)

> NE dijeli `service_role` ključ ni database password.

## 5. Claude spaja aplikacije
Claude će:
- napraviti `.env` (web) i `.env` (mobile) s tvojim ključevima (ne commitaju se),
- isključiti DEMO mod (automatski, jer sad postoji konfiguracija),
- pokrenuti obje aplikacije i provjeriti da prijava i podaci rade uživo.

## Kasnije promjene
- **Izgled/tekst/funkcije:** mijenjaš kod kad god — ne dira bazu.
- **Nova polja u bazi:** nova migracija (`0006_…sql`) koju pokreneš u SQL Editoru. Radimo dodavanjem, ne brišemo — podaci ostaju.
- **Demo mod** ostaje kao rezerva (radi čim makneš `.env`).
