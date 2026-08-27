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

## 6. Nadogradnja već postavljenog projekta

Povezani produkcijski projekt trenutno je usklađen s migracijama `0001`–`0017`.
Za svaku buduću promjenu baze dodaje se nova migracija; postojeće migracije se
ne mijenjaju nakon što su jednom primijenjene.

Najsigurnije je iz korijena projekta pokrenuti:

```powershell
npx.cmd supabase db push --dry-run
npx.cmd supabase db push
```

Prva naredba samo pokaže što će se promijeniti, a druga primijeni migracije.
Ako se koristi **SQL Editor**, ne upisuj putanju datoteke kao SQL naredbu. Otvori
svaku migraciju koja nedostaje, kopiraj njezin cijeli sadržaj u **New query** i
pokreni ih redom. Za potpuno novi projekt dovoljan je ažurirani `supabase/all.sql`.

Migracije `0012`–`0017` donose samostalnu prijavu predstavnika, MVP glasanje i
ručni izbor, kontakte organizatora, realtime osvježavanje ekipa i dana te
sigurno spajanje sastava pri odobravanju prijave bez dupliciranja igrača.

Zatim ponovno deployaj Edge Function **admin-users** sadržajem iz
`supabase/functions/admin-users/index.ts`. Nova verzija sprječava delegate da
kreiraju ili promoviraju druge admine.

## Kasnije promjene
- **Izgled/tekst/funkcije:** mijenjaš kod kad god — ne dira bazu.
- **Nova polja u bazi:** nova migracija (sljedeći broj iza postojeće) koju prvo provjerimo pa primijenimo. Radimo dodavanjem, ne brišemo — podaci ostaju.
- **Demo mod** ostaje kao rezerva (radi čim makneš `.env`).
