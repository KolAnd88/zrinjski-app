# CLAUDE.md — Upute za Claude Code

Ovo je projekt mobilne i web aplikacije za **rukometni turnir veterana** kluba **VHMRK Zrinjski Mostar**.
Pročitaj OVAJ dokument prvi, zatim `PROJEKT.md` (što gradimo) i `DIZAJN.md` (kako izgleda). Mockupi svih ekrana su u `ekrani/`.

## Što gradimo
Tri površine koje dijele istu Supabase bazu (realtime):
1. **Korisnička aplikacija** (mobilna, iOS + Android) — za gledatelje/navijače. Besplatna.
2. **Mobilni admin** — za organizatore/delegate (unos uživo s terena).
3. **Web admin** (laptop) — za zapisničara koji vodi utakmicu; može pokrenuti TV/semafor na projektoru.

Aplikacija je **generička i potpuno konfigurabilna kroz admin** — sve (ekipe, igrači, dani, satnica, sponzori, lokacije) unosi se u adminu, ništa nije zakucano u kodu.

## Tehnološki stack (dogovoreno)
- **Mobilna app + mobilni admin:** React Native + **Expo** (TypeScript).
- **Web admin:** React (Vite) + TypeScript. (Može dijeliti logiku/tipove s mobilnom kroz monorepo paket.)
- **Backend / baza:** **Supabase** (Postgres + Auth + Realtime + Storage). Vidi `baza.md`.
- **Push notifikacije:** Expo Notifications (FCM/APNs).
- **Karte/navigacija:** deep-link na Google Maps / Apple Maps (ne ugrađena karta, samo otvori navigaciju na koordinate).
- **Realtime:** Supabase Realtime — unos uživo se na korisničkim uređajima vidi odmah.

## Predložena struktura repozitorija (monorepo)
```
/apps
  /mobile        # Expo app (korisnik + mobilni admin)
  /web-admin     # React (Vite) web admin
/packages
  /core          # dijeljeni tipovi, Supabase klijent, domenska logika (satnica, bodovanje)
  /ui-tokens     # dizajn tokeni (vidi dizajn/tokens.ts)
/supabase        # SQL migracije, RLS politike (vidi baza.md)
```
Ako je monorepo prekompleksno za početak, smije se krenuti s dvije zasebne mape (`mobile`, `web-admin`) i dijeljenim `core` kopiranim ručno — ali monorepo je preporuka.

## Redoslijed rada (faze) — radi ovim redom
1. **Faza 2 — Baza i jezgra:** postavi Supabase, kreiraj sheme i tablice iz `baza.md`, RLS politike, Auth (magic-link/email za admin). Generiraj TypeScript tipove iz baze. Napravi `packages/core` sa Supabase klijentom i domenskom logikom: **auto-satnica** (generiranje termina iz trajanja+razmaka+početka po danu) i **bodovanje** (2/1/0, gol-razlika, prve 2 prolaze).
2. **Faza 3 — Admin (mobilni + web):** prvo admin jer puni podatke. Login → Postavke/Turnir (dani preko kalendara, satnica) → Ekipe/igrači → Sponzori → Unos uživo → Obavijesti → Promo → Prijave → TV mod.
3. **Faza 4 — Korisnička app:** Onboarding → Početna → Raspored → Poredak/bracket → Statistika → Live tijek → Detalj ekipe → Info/karta → Galerija → Pretraga → Obavijesti-postavke.
4. **Faza 5 — Push, realtime polish, offline+sync, dijeljenje na mreže, QR plakat/auto-objava.**
5. **Faza 6 — Build i objava** (Apple $99/god, Google $25 jednokratno). Računi se otvaraju kasnije, bliže objavi — NE blokira razvoj.

## Pravila i konvencije
- **Jezik sučelja:** hrvatski (default) + engleski. Sve stringove drži u i18n datotekama, ne hardkodiraj tekst.
- **Dizajn:** STROGO prati `DIZAJN.md` i `dizajn/tokens.ts`. Ne izmišljaj boje/razmake — koristi tokene. Svaki ekran ima mockup u `ekrani/` (vidi mapu naziva u `DIZAJN.md`).
- **Mjerne jedinice / format:** vrijeme `HH:MM`, datumi `D.M.YYYY.`, dan u tjednu se računa iz datuma.
- **Tamna tema** je jedina tema (atletski, premium). Crvena = jedini akcent; zlatna SAMO za zlatnog sponzora i finale.
- **Dodirne mete ≥ 44px.** 8pt ritam razmaka.
- **Realtime prvo:** sve što admin unese mora se vidjeti na korisničkoj app bez ručnog osvježavanja.
- Piši **TypeScript**, tipiziraj sve iz baze (generirani tipovi). Male, čitljive komponente.
- Commitaj po fazama; ne diraj objavu/račune dok ne dođe Faza 6.

## Kako početi (prijedlog prve poruke korisnika Claude Codeu)
> "Pročitaj CLAUDE.md, PROJEKT.md, DIZAJN.md i baza.md. Postavi monorepo i Supabase shemu iz baza.md (migracije + RLS). Zatim generiraj TS tipove i napravi packages/core sa Supabase klijentom, auto-satnicom i bodovanjem. Stani i pokaži mi shemu prije nego nastavimo na admin."

## Napomene o postavljanju
- Za Supabase trebaju `SUPABASE_URL` i `SUPABASE_ANON_KEY` (+ service key samo za migracije). Drži ih u `.env`, NE commitaj.
- Za Expo push trebat će projekt na expo.dev (kasnije).
- Računi za trgovine (Apple/Google) — tek u Fazi 6; org/klub račun.
