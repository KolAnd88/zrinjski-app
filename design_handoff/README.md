# Handoff: Turnir veterana — mobilna aplikacija + admin sučelje

## Pregled
Aplikacija za turnir veterana u rukometu (VHMRK Zrinjski, Bijeli Brijeg, Mostar).
Jedno mjesto odigravanja (jedan teren), turnir u grupama + play-off, muška i ženska
konkurencija. Pokriva tri korisničke role:

1. **Gledatelj / igrač (mobitel)** — rezultati uživo, raspored, poredak, statistika, info.
2. **Delegat / zapisničar (tablet)** — unos golova, vrijeme, kartoni, undo.
3. **Prijenos (projektor / TV)** — veliki semafor za dvoranu i stream.

## O datotekama u ovom paketu
Datoteke u `design/` su **dizajnerske reference napisane u HTML-u** — prototipovi koji
pokazuju željeni izgled i ponašanje. **Nisu produkcijski kod za kopiranje.**

Zadatak je **ponovno izgraditi te ekrane u ciljanom projektu** koristeći njegov postojeći
stack i obrasce (React Native / Flutter / React web / SwiftUI…). Ako projekt još ne postoji,
odaberi najprikladniji framework i implementiraj dizajn tamo.

Preporuka ako se kreće od nule: **React Native (Expo)** za mobitel + tablet zapisnik,
**React (Vite)** za TV/projektor prikaz, jedan zajednički API.

Napomena o formatu: `.dc.html` datoteke su komponente iz dizajnerskog okruženja. Struktura je
`<x-dc>` template (markup s inline stilovima) + `class Component extends DCLogic` (logika,
state, podaci). Čitaj template kao JSX, a `renderVals()` kao izvor podataka/state-a.
`{{ x }}` je interpolacija, `<sc-for list>` je `.map()`, `<sc-if value>` je uvjetni render.

## Fidelity
**High-fidelity (hifi).** Boje, tipografija, spacing, radijusi, sjene i animacije su konačni.
UI treba rekreirati pixel-perfect, ali koristeći komponente i biblioteke ciljanog codebasea.
Sav tekst (hrvatski) je konačan — ne prevoditi i ne prepisivati.

---

## Design tokeni

### Boje
| Token | Hex | Upotreba |
|---|---|---|
| `bg/app` | `#0B0B0E` | pozadina ekrana |
| `bg/app-outer` | `radial-gradient(120% 80% at 50% 0%, #17181D 0%, #000 60%)` | pozadina izvan okvira (desktop preview) |
| `bg/surface` | `#15161B` | kartice, liste, inputi |
| `bg/surface-raised` | `#1A1B21` | gornji stop gradijenta kartice |
| `bg/surface-sunken` | `#121217` | donji stop gradijenta kartice |
| `border/default` | `#2A2B33` | rub kartice |
| `border/subtle` | `#23242C` | separator, rub ekrana |
| `border/row` | `#1D1E25` | separator redova u listi |
| `text/primary` | `#F4F4F5` | glavni tekst |
| `text/secondary` | `#C9CDD4` | sekundarni tekst |
| `text/muted` | `#9AA0AA` | labeli, meta |
| `text/dim` | `#6B7079` | "vs", neaktivni brojevi |
| `nav/inactive` | `#7A8089` | neaktivna ikona u tab baru |
| `brand/red` | `#E11D2A` | primarni akcent, vremena, CTA |
| `brand/red-dark` | `#9C0C18` | drugi stop crvenog gradijenta |
| `brand/red-light` | `#FF5662` | live tekst, countdown |
| `brand/red-nav` | `#FF4651` | aktivna ikona u tab baru |
| `accent/blue` | `#2D6CDF` | tekstualni linkovi ("Cijeli raspored") |
| `accent/gold` | `#D9B24A` | zlatni sponzor, 1. mjesto, trofej |
| `accent/gold-text` | `#C9B26A` | podnaslov zlatnog sponzora |
| `state/green` | `#22C55E` | pozitivno (pobjeda, 1. mjesto) |
| `crest/teal` | `linear-gradient(150deg,#2596A8,#1F7A8C)` | grb ekipe |
| `crest/purple` | `linear-gradient(150deg,#7D27CC,#4A127F)` | grb ekipe |
| `crest/orange` | `linear-gradient(150deg,#D4500F,#C2410C)` | grb ekipe |
| `crest/red` | `linear-gradient(150deg,#E11D2A,#9C0C18)` | grb Zrinjskog |

Gradijent za "live" hero: `linear-gradient(165deg,#23090C 0%,#15161B 52%,#121217 100%)`,
rub `#4A1117`.

### Tipografija
- **Oswald** (500/600/700) — brojevi, rezultati, labeli sekcija, imena ekipa (uppercase).
- **Inter** (400/500/600/700) — tekst, opisi, imena igrača.

| Stil | Font | Size | Weight | Letter-spacing |
|---|---|---|---|---|
| Rezultat (hero) | Oswald | 54px | 700 | 1px, line-height .9 |
| Rezultat (TV) | Oswald | 200px+ | 700 | 2px |
| Naslov brenda | Oswald | 21px | 700 | .6px |
| Naslov kartice | Oswald | 16px | 700 | .3px |
| Ime ekipe (hero) | Oswald | 14px | 600 | .4px, uppercase |
| Label sekcije | Oswald | 12px | 600 | 1.4px, uppercase |
| Micro label | Oswald | 11px | 700 | 1.4px, uppercase |
| Body | Inter | 14px | 500/600 | — |
| Meta / caption | Inter | 12px | 400/500 | — |
| Chip tekst | Inter | 11px | 500 | — |

### Spacing i geometrija
- Skala: 4 / 6 / 9 / 11 / 13 / 14 / 18 / 22 px.
- Horizontalni padding sadržaja: **18px**; padding headera: **22px**.
- Razmak između sekcija: **22px** (label sekcije `margin: 22px 4px 9px`).
- Radijusi: `9px` mali grb · `11px` chip/logo · `14px` kartica · `15px` veliki grb ·
  `20px` hero kartica · `34px` okvir uređaja · `999px` pill.
- Okvir mobilnog ekrana u prototipu: **402 × 858 px** (iPhone 14/15 logical size).
  Bottom nav visina ~72px, padding `12px 6px 20px` (safe area).

### Sjene
- Kartica: `0 6px 16px -10px rgba(0,0,0,.8)`
- Hero: `0 20px 44px -16px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.03)`
- Hero live: `0 20px 44px -16px rgba(225,29,42,.4)`
- Grb: `0 10px 24px -8px rgba(225,29,42,.7)`
- Zlatni sponzor: `0 8px 22px -12px rgba(217,178,74,.4)`

### Animacije
| Ime | Trajanje / easing | Opis |
|---|---|---|
| `pulse` | 1.4s ease-in-out infinite | live točka: opacity 1→.35, scale 1→.82 |
| `glow` | 2.2s ease-in-out infinite | ring oko "UŽIVO" badgea, `box-shadow` spread 0→6px |
| `sheen` | 4.5s ease-in-out infinite | svjetlosni prelaz preko zlatnog sponzora |
| `marquee` | 22s linear infinite (konfigurabilno 6–40s) | rotirajuća traka sponzora, `translateX(0 → -50%)`, pauza na hover |
| press | `transform .12s` → `scale(.985)` | tap feedback na karticama |
| pull-to-refresh | prag 70px, spinner 1.1s | vidi `_initPTR()` u `Pocetna.dc.html` |

Dekorativni element brenda: dijagonalna crvena "lenta" — traka rotirana `-62deg`
(pozadina ekrana, opacity .15) odnosno `-9deg` (unutar live hero kartice, opacity .16).

---

## Ekrani

### 1. Početna (`Pocetna.dc.html`)
**Svrha:** jedan pogled na "što se sada događa".
**Layout:** status bar → brand header (logo 42px + naziv + ikona profila) → scrollable
sadržaj (`padding: 4px 18px 92px`) → fiksni bottom nav.

Sekcije, po redu:
1. **Hero** — dva stanja:
   - *Live*: badge `UŽIVO · FINALE` (pulsirajuća točka), oznaka "Za zlato", grid
     `1fr auto 1fr` s grbovima 56px i rezultatom 54px, footer s poluvremenom i minutom,
     CTA `OTVORI PRIJENOS`, ispod horizontalno skrolajuća **timeline golova**
     (chip: strana + ime strijelca + minuta).
   - *Nije live*: `SLJEDEĆA UTAKMICA` + countdown, grbovi + "vs", footer
     `DANAS 19:00 · POLUFINALE` + `Podsjeti me →`.
2. **Pratiš** — kartica praćene ekipe (grb, ime, grupa + mjesto, link "Promijeni").
3. **Zlatni sponzor** — istaknuta kartica sa zlatnim rubom i `sheen` animacijom.
4. **Sponzori** — beskonačna marquee traka logotipa (110 × 50px pločice), maskirani rubovi.
5. **Sljedeće na rasporedu** — 3 utakmice; countdown se prikazuje samo na prvoj.
6. **Večernji program** — vrijeme + opis (20:30 večera i dodjela, 21:00 druženje).

**Bottom nav:** Početna · Raspored · Poredak · Statist. · Info. Aktivna ikona `#FF4651`
s radijalnim crvenim glowom iza; neaktivna `#7A8089`.
**Interakcije:** pull-to-refresh (touch + miš), tap na hero → prijenos, tap na utakmicu →
detalj, tap na ekipu → Ekipa.

### 2. Utakmica — detalj (`Utakmica.dc.html`)
Rezultat, poluvrijeme, kronologija golova s imenima strijelaca, sastavi obiju ekipa
(pune ime + prezime, broj, mjesto na fotografiji), head-to-head povijest susreta.

### 3. Uživo / prijenos (`Uzivo.dc.html`)
Gledateljski live prikaz: veliki rezultat, minuta, tijek golova u realnom vremenu.

### 4. Raspored (`Raspored.dc.html`)
Utakmice grupirane po danu, filter M/Ž, oznake faze (grupa / polufinale / finale),
odigrane utakmice s konačnim rezultatom, buduće s vremenom.

### 5. Poredak (`Poredak.dc.html`)
Tablica grupa: mjesto, grb, ime, odigrano, gol-razlika, bodovi. Toggle **M / Ž**.
Prvo mjesto u zlatnoj boji, praćena ekipa istaknuta (`font-weight: 700`, svjetliji tekst).

### 6. Statistika (`Statistika.dc.html`)
Najbolji strijelci (pune ime, ekipa, golovi), toggle **M / Ž**, dodatne kategorije
(najbolji vratar, najviše asistencija), turnirski totali.

### 7. Info (`Info.dc.html`)
Lokacija (Bijeli Brijeg, Mostar) s mjestom za fotografiju/kartu, pravila turnira,
kontakti organizatora, sponzori, povijest turnira.

### 8. Ekipa (`Ekipa.dc.html`)
Profil ekipe: grb, grupa, forma, cijeli sastav s fotografijama i punim imenima,
odigrane i buduće utakmice.

### 9. Admin (`Admin.dc.html`)
Sučelje organizatora: pregled utakmica, unos rezultata **po igraču** — lista igrača s
`+` gumbom uz svakoga, svaki `+gol` bilježi strijelca, upisuje se u kronologiju i može se
poništiti (undo). Upravljanje rasporedom i ekipama.

### 10. Zapisnik (`Zapisnik.dc.html`) — tablet, landscape
Sučelje za zapisničara uz teren. Veliki hit targeti (min 44px, u praksi 56–72px),
dvije kolone (domaći / gosti), lista igrača s `+` gumbima, kontrola vremena
(start / pauza / poluvrijeme), kartoni, **undo posljednje akcije**, prikaz kronologije.

### 11. TV / semafor (`TV.dc.html`) — projektor, 1920 × 1080
Prikaz za dvoranu i stream: rezultat 200px+, imena ekipa, minuta, zadnji golovi,
sponzorska traka. Bez interakcije — samo prikaz, podaci se osvježavaju automatski.

---

## Stanje i podaci

### Modeli
```
Team      { id, name, abbr (3 slova), crestGradient, gender: 'M'|'F', group }
Player    { id, teamId, firstName, lastName, number, photoUrl }
Match     { id, homeTeamId, awayTeamId, startsAt, stage: 'group'|'semi'|'final',
            gender, status: 'scheduled'|'live'|'halftime'|'finished',
            homeScore, awayScore, half: 1|2, minute }
Goal      { id, matchId, playerId, side: 'home'|'away', minute, createdAt }
Card      { id, matchId, playerId, type: '2min'|'yellow'|'red', minute }
Standing  { teamId, group, played, won, drawn, lost, goalsFor, goalsAgainst, points }
Sponsor   { id, name, logoUrl, tier: 'gold'|'standard' }
```

### Stanje po ekranu
- **Početna:** `liveMatch` (ima li utakmice uživo), `minute` (tick 5s u prototipu — u
  produkciji dolazi sa servera), `remaining` (countdown, tick 1s), pull-to-refresh stanje.
- **Zapisnik / Admin:** `match`, `goals[]`, `cards[]`, `clock` (running/paused, elapsed),
  `undoStack[]` — svaka akcija je reverzibilna; undo briše posljednji zapis i vraća rezultat.
- **Poredak / Statistika:** `gender` toggle ('M' | 'F').

### Dohvat podataka
Live ekrani (Početna hero, Uživo, TV, Zapisnik) trebaju real-time kanal —
WebSocket ili polling na 5–10s. Ostali ekrani mogu se dohvatiti na mount + pull-to-refresh.
Zapisnik mora raditi **offline-first** (dvorana bez signala): lokalni upis akcija +
sinkronizacija kad se veza vrati.

---

## Assets
Prototip ne sadrži prave slike. Umjesto njih:
- **Grbovi ekipa** — CSS gradijent + tri slova (`ZRI`, `LJU`, `GRU`, `IZV`, `LAS`, `MOS`,
  `POS`). Zamijeniti pravim logotipima kad budu dostupni; zadržati zaobljeni kvadrat.
- **Fotografije igrača, dvorane, povijesti** — placeholderi (`image-slot.js`). Treba prave
  fotografije od organizatora.
- **Sponzorski logotipi** — trenutno tekstualne pločice s imenom na `#15161B`. Prave
  logotipe stavljati na bijelu podlogu (kao zlatni sponzor) radi kontrasta na tamnoj temi.
- **Fontovi** — Google Fonts: Inter (400,500,600,700), Oswald (500,600,700). U native
  aplikaciji ih bundlati lokalno.
- **Ikone** — inline SVG, stroke-based, `stroke-width` 1.9–2.4, `stroke-linecap: round`.
  Zamjenjivi bilo kojom stroke ikon-bibliotekom (Lucide je najbliži).

## Datoteke
Sve u `design/`:

| Datoteka | Ekran |
|---|---|
| `Pocetna.dc.html` | Početna (mobitel) |
| `Utakmica.dc.html` | Detalj utakmice |
| `Uzivo.dc.html` | Prijenos uživo (gledatelj) |
| `Raspored.dc.html` | Raspored |
| `Poredak.dc.html` | Poredak / tablice |
| `Statistika.dc.html` | Statistika |
| `Info.dc.html` | Info o turniru |
| `Ekipa.dc.html` | Profil ekipe |
| `Admin.dc.html` | Admin sučelje |
| `Zapisnik.dc.html` | Zapisnik (tablet) |
| `TV.dc.html` | Semafor / projektor |
| `support.js`, `image-slot.js` | runtime prototipa — **ne portirati** |

Za pregled: otvoriti bilo koju `.dc.html` datoteku u pregledniku (potreban je
`support.js` u istoj mapi).

## Prvi koraci za implementaciju
1. Postaviti temu (boje, fontovi, spacing, radijusi) iz sekcije Design tokeni.
2. Izgraditi zajedničke primitive: `Card`, `SectionLabel`, `TeamCrest`, `Pill/Badge`,
   `ScoreDisplay`, `BottomNav`.
3. Početna → Utakmica → Raspored (najviše ponovne upotrebe).
4. Zapisnik (tablet) — najkritičniji za rad turnira; testirati na pravom tabletu na terenu.
5. TV prikaz — provjeriti čitljivost s 15+ metara.
