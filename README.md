# VHMRK Zrinjski Cup — Handoff paket za Claude Code

Ovo je kompletan paket za programiranje aplikacije (mobilna + web) za rukometni turnir veterana VHMRK Zrinjski Mostar.

## Kako koristiti
1. Raspakiraj ovaj `.zip` u **praznu mapu** (npr. `zrinjski-app`).
2. U toj mapi pokreni **Claude Code** (`claude` u terminalu unutar mape, ili otvori mapu u Claude Code aplikaciji).
3. Kao prvu poruku napiši:
   > „Pročitaj CLAUDE.md, PROJEKT.md, DIZAJN.md i baza.md. Postavi monorepo i Supabase shemu iz baza.md (migracije + RLS), generiraj TS tipove i napravi packages/core (Supabase klijent, auto-satnica, bodovanje). Stani i pokaži mi shemu prije nastavka."
4. Dalje gradite ekran po ekran prema mockupima u `ekrani/`.

## Sadržaj paketa
- **CLAUDE.md** — upute za Claude Code (stack, struktura, faze, konvencije). PROČITATI PRVO.
- **PROJEKT.md** — što gradimo: sve funkcije, uloge, logika natjecanja, troškovi.
- **DIZAJN.md** — dizajn-sustav + mapa svih ekrana → koja PNG datoteka je koji ekran.
- **baza.md** — predložena shema baze (tablice, enumi, RLS, realtime, domenska logika).
- **dizajn/tokens.ts** — boje, tipografija, razmaci kao kod (koristiti svuda).
- **dizajn/specifikacija-original.md** — izvorna detaljna specifikacija (v3) za referencu.
- **ekrani/** — svi hi-fi mockupi (28 PNG): dizajn-sustav, korisnička app, mobilni admin, web admin.

## Stack (dogovoreno)
React Native + Expo (mobilna app + mobilni admin), React + Vite (web admin), Supabase (Postgres + Auth + Realtime + Storage), Expo push, deep-link na Google/Apple Maps. TypeScript svuda.

## Redoslijed (faze)
2) Baza i jezgra → 3) Admin → 4) Korisnička app → 5) Push/realtime/offline/dijeljenje → 6) Build i objava (računi za trgovine kasnije, ne blokira razvoj).
