# DIZAJN.md — Dizajn-sustav i mapa ekrana

Vizualni jezik: **tamno, atletski, premium.** Sadržaj prvo (rezultat i uživo dominiraju). **Jedan akcent — crvena.** Zlatna SAMO za zlatnog sponzora i finale. Dijagonalna crvena „lenta" je suptilan potpis. Dodirne mete ≥ 44px, dosljedan 8pt ritam razmaka.

Tokeni u kodu: vidi `dizajn/tokens.ts`. Vizualne ploče sustava: `ekrani/ds_foundations.png` i `ekrani/ds_components.png`.

## Boje (tokeni)
| Token | Hex | Uporaba |
|------|-----|---------|
| red | #E11D2A | primarni akcent, akcije, UŽIVO |
| redDk | #9C0C18 | lenta, gradijenti |
| blue | #2D6CDF | sekundarno, „Karta"/info |
| gold | #D9B24A | SAMO zlatni sponzor + finale |
| bg | #0B0B0E | pozadina |
| card | #15161B | kartica |
| card2 | #1C1D24 | kartica/povišeno |
| line | #2A2B33 | linije/obrubi |
| txt | #F4F4F5 | glavni tekst |
| sub | #9AA0AA | sekundarni tekst |
| mut | #6B7079 | prigušeno |
| green | #22C55E | uspjeh/prolaz/odobri |

> Boje ekipa nisu u ovoj tablici — vidi „Grbovi ekipa" niže.

## Grbovi ekipa (boje i logotipi)

**Nema master tablice ekipa → boja.** Boja grba se **računa iz indeksa ekipe**
(`crestColorFor(team.sort_order)`); ponavljanje boja je dopušteno i **nije greška**.

Boja grba **nije nositelj informacije** — ne označava grupu, plasman ni status.

| # | Hex | |
|---|-----|---|
| 0 | #1F6F6B | teal |
| 1 | #4A127F | ljubičasta |
| 2 | #C2571B | narančasta |
| 3 | #1E4FA3 | plava |
| 4 | #2F7D4F | zelenkasta |
| 5 | #6B2233 | burgundy |

U paleti namjerno **nema** brend-crvene (`#E11D2A`/`#9C0C18`), zlatne (`#D9B24A`)
ni zelene (`#22C55E`) — te tri imaju svoje značenje.

**Logotip je opcionalan.** Jedna komponenta (`Crest`, mobilna + web) crta grb svugdje:
1. ima li ekipa `logo_url` → slika uklopljena (`contain`), **nikad obrezana**, na neutralnoj podlozi;
2. inače → **krug** u boji iz palete s 2–3 slovnom kraticom (Oswald, bijelo, centrirano).

Nikad prazna rupa ni generička placeholder ikona. Veličine: popis/raspored 32,
poredak 28, zaglavlje ekipe i detalj utakmice 56, uživo 72, TV semafor 120.
Upload logotipa: web admin → Ekipe → „Logo ekipe" (PNG/SVG, prozirna pozadina,
preporučeno 512×512, najviše 512 KB; sprema se u Storage bucket `team-logos`).

## Tipografija
- **Oswald** (700/600) — naslovi, rezultati, oznake; često VELIKIM slovima, blagi letter-spacing.
- **Sustavni sans / Inter** (400/500/600) — tekst, opisi, tablice.
- Skala: Display/rezultat 40–120, H1 ~24–28, H2/sekcija ~18 (uppercase), oznaka/badge ~11–12 uppercase, body ~13–15, caption ~10–12.

## Razmaci i oblici
- Razmak: 4 / 8 / 12 / 16 / 24 / 32 (8pt baza).
- Radijusi: kartica **12**, chip **8**, pill **999**.
- Phone ekrani 390px širine; web admin 1280×800 landscape.

## Ključne komponente (vidi ds_components.png)
Gumbi (primarni crveni / sekundarni obrub / ghost / tap-+), chipovi (izbor događaja, M/Ž toggle), oznake (UŽIVO crveno, ZAVRŠENO, FINALE zlatni obrub, „nema sudara" zeleno), red utakmice (grb + naziv + rezultat/UŽIVO), red igrača s „+", donja navigacija (6: Početna/Raspored/Poredak/Statist./Galerija/Info), istaknuti blokovi (zlatni sponzor, finale).
Grb ekipe = **krug** s logotipom ekipe ili, ako logotipa nema, s 2–3 slovnom kraticom (npr. ZRI, GRU) u automatski dodijeljenoj boji — vidi „Grbovi ekipa". Donja navigacija (korisnička) i crveno zaglavlje + izbornik u pločicama (admin).

## Mapa ekrana → mockup datoteke (sve u `ekrani/`)

### Dizajn-sustav
- `ds_foundations.png` — principi, boje, tipografija, razmaci
- `ds_components.png` — komponente

### Korisnička aplikacija (mobilna, 390px)
- `hifi_onboarding.png` — onboarding (3 koraka: jezik → prati ekipu → obavijesti)
- `hifi_home.png` — Početna (hero, pratiš, UŽIVO, sljedeće, zlatni + ostali sponzori, danas program)
- `hifi_raspored.png` — Raspored kao timeline dana (utakmice + program)
- `hifi_poredak.png` — Poredak (ljestvice + pun raspored po grupama + bracket)
- `hifi_stats.png` — Statistika (4 kategorije, najbolji igrač)
- `hifi_live.png` — Live tijek utakmice (gledatelj)
- `hifi_team.png` — Detalj ekipe / info o protivniku
- `hifi_info.png` — Info (klub, turnir, mapa+pinovi, lokacije, hoteli, pravila)
- `hifi_gallery.png` — Galerija po danima
- `hifi_search.png` — Pretraga (igrači/ekipe/termini)
- `hifi_notif.png` — Obavijesti-postavke (toggle po tipu + praćene ekipe)

### Mobilni admin (390px, crveno zaglavlje + pločice izbornik)
- `hifi_admin_login.png` — Login (skriveni ulaz)
- `hifi_admin_dash.png` — Nadzorna ploča
- `hifi_admin_live.png` — Unos uživo (zapisničar)
- `hifi_admin_tv.png` — TV / semafor mod (landscape)
- `hifi_admin_settings.png` — Postavke (stariji prikaz s poljima početka)
- `hifi_admin_days.png` — Postavke → DANI TURNIRA (dodavanje na „+") ← AKTUALNO
- `hifi_admin_datepicker.png` — Skočni kalendar (biraš datum/godinu) ← AKTUALNO
- `hifi_admin_teams.png` — Ekipe i igrači (uređivanje + e-mail predstavnika)
- `hifi_admin_sponsors.png` — Sponzori (zlatni + ostali + upload)
- `hifi_admin_notices.png` — Obavijesti + automatski podsjetnici
- `hifi_admin_promo.png` — Promo (QR plakat + auto-objava)
- `hifi_admin_prijave.png` — Prijave (odobravanje ekipa)

> Napomena: za satnicu koristi `hifi_admin_days.png` + `hifi_admin_datepicker.png` (dani se dodaju kalendarom). `hifi_admin_settings.png` je ranija varijanta — preuzmi samo polja trajanje/razmak.

### Web admin (laptop, 1280×800 landscape)
- `hifi_web_live.png` — Unos uživo (obje ekipe usporedno; tijek kompaktan ispod sastava; sljedeće 3 utakmice u lijevom stupcu)
- `hifi_web_schedule.png` — Raspored i auto-satnica (lijevo postavke+dani, desno generirana satnica)
- `hifi_web_tv.png` — TV / semafor preko cijelog ekrana (za projektor)

## Pravila primjene
- Ne odstupaj od tokena; sve boje/razmaci/radijusi dolaze iz `tokens.ts`.
- UŽIVO/realtime stanja uvijek crvena. Finale i zlatni sponzor jedini smiju biti zlatni.
- Boje ekipa se NE biraju ručno niti hardkodiraju po nazivu kluba — uvijek `crestColorFor(team.sort_order)`.
- Admin = crveno zaglavlje + izbornik u pločicama; korisnik = donja navigacija sa 6 stavki.
- Mockupi su smjernica za raspored i hijerarhiju, ne piksel-savršen zahtjev; drži se sustava i proporcija.
