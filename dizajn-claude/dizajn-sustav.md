# Dizajn-sustav — VHMRK Zrinjski Cup (za Claude)

Aplikacija za rukometni turnir veterana. Vizual: **tamno, atletski, premium.**
Sadržaj prvo (rezultat i „uživo" dominiraju). **Jedan akcent — crvena.**
Dijagonalna crvena „lenta" je suptilan potpis.

## Boje (koristi točno ove)
| Uloga | Hex |
|------|-----|
| Crvena (akcent, akcije, UŽIVO) | `#E11D2A` |
| Tamno crvena (lenta, gradijent) | `#9C0C18` |
| Plava (sekundarno, „Karta"/info) | `#2D6CDF` |
| Zlatna (SAMO finale + zlatni sponzor) | `#D9B24A` |
| Pozadina | `#0B0B0E` |
| Kartica | `#15161B` |
| Kartica povišena | `#1C1D24` |
| Linije / obrubi | `#2A2B33` |
| Tekst glavni | `#F4F4F5` |
| Tekst sekundarni | `#9AA0AA` |
| Tekst prigušeni | `#6B7079` |
| Zelena (uspjeh / prolaz / odobreno) | `#22C55E` |
| Boje gostujućih ekipa (primjeri) | `#2D6CDF #6A1FB0 #1F7A8C #C2410C #0D9488 #B03060` |

**Pravilo zlatne:** nikad za obične elemente — samo finale i zlatni sponzor.
UŽIVO/realtime stanja = uvijek crvena.

## Tipografija
- **Oswald** (700/600) — naslovi, rezultati, oznake; često VELIKIM slovima, blagi letter-spacing.
- **Inter** (400/500/600) — tekst, opisi, tablice.
- Skala: rezultat 40–120px, H1 ~26px, sekcija ~18px (uppercase), oznaka/badge ~11–12px uppercase, body ~13–15px.
- Google Fonts: `Oswald` i `Inter`.

## Razmaci i oblici
- Razmaci (8pt baza): 4 / 8 / 12 / 16 / 24 / 32.
- Radijusi: kartica **12px**, chip **8px**, pill **999px**.
- Dodirne mete ≥ 44px.
- Mobilni ekran ~390px širine; admin/laptop ~1280px.

## Ključne komponente
- **Grb ekipe**: zaobljeni kvadrat u boji ekipe s 3-slovnom kraticom (ZRI, GRU…), bijeli tekst.
- **Oznaka UŽIVO**: crveni pill, opcionalno pulsirajuća točkica.
- **Red utakmice**: vrijeme · grb + ime · rezultat / UŽIVO / „vs" · ime + grb.
- **Kartice**: tamna podloga `#15161B`, obrub `#2A2B33`, radijus 12.
- **Finale**: zlatni obrub umjesto crvenog.
- Donja navigacija (mobilna, 6 stavki): Početna / Raspored / Poredak / Statistika / Galerija / Info.
- Admin (laptop): lijevi izbornik + sadržaj desno; crveni akcent na aktivnoj stavci.

## Ton
Sažeto, sportski, hrvatski jezik. Bez pretrpavanja — rezultat i sljedeća utakmica su najvažniji.

> Kad predlažeš dizajn: zadrži tamnu temu i ova pravila boja; možeš mijenjati raspored,
> proporcije, sjene, mikro-animacije. Uvijek prikaži rezultat kao HTML artifact.
