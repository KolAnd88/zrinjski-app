# PROJEKT.md — VHMRK Zrinjski Cup (mobilna + web aplikacija)

## Kontekst
Aplikacija za **rukometni turnir veterana** kluba **VHMRK Zrinjski Mostar**. Muška i ženska konkurencija (odvojene grupe, ljestvice, statistike). Besplatna za korisnike, distribucija na Google Play + App Store. Naziv app: **VHMRK Zrinjski**. Provizorni bundle ID: `ba.vhmrkzrinjski.app`.

## Ključne postavke turnira
- **Jedna dvorana** (Bijeli Brijeg, Mostar), **jedna utakmica u isto vrijeme**, igra se slijedno (nema paralelnih terena). Šator ispred dvorane (parking).
- Turnir traje više dana (tipično: dolazak + 1. večer → utakmice + 2. večer → utakmice + finala + završna večera na drugoj lokaciji). **Broj i datumi dana se NE zakucavaju** — dodaju se u adminu preko kalendara.
- **Utakmica = 1 poluvrijeme = 15 min** (KONFIGURABILNO).
- **Format:** grupe → završnica. **Bodovanje 2/1/0**, neriješeno se razbija gol-razlikom, **prve 2 iz grupe prolaze**.
- Sve konfigurabilno kroz admin; ništa hardkodirano.

## Uloge
| Uloga | Pristup | Ukratko |
|------|---------|--------|
| Gledatelj/navijač | bez logina | prati sve, uživo, prati ekipu |
| Predstavnik ekipe | login (magic-link) | prijava ekipe, upravlja sastavom |
| Admin / delegat | login | konfigurira sve i unosi rezultate uživo |

## Korisničke funkcije (mobilna app)
1. **Onboarding** (3 koraka): jezik (HR/EN) → prati svoju ekipu → uključi obavijesti.
2. **Početna:** hero + dijagonalna lenta, „pratiš" traka, **UŽIVO kartica** (najistaknutija), sljedeće na rasporedu, **zlatni sponzor** (velik) + **ostali sponzori** (traka logotipa), današnji program.
3. **Raspored — timeline dana:** odabir dana, na jednoj vremenskoj crti pomiješane utakmice + društveni program; finale istaknuto; program ima gumb „Karta".
4. **Poredak:** M/Ž preklopnik; po grupi: ljestvica (prve 2 zeleno = prolaz) + **kompletan raspored te grupe** (svaka utakmica: vrijeme + rezultat/UŽIVO/vs); ispod **ZAVRŠNICA / vizualni bracket** (polufinala → finale (zlatno) → za 3. mjesto).
5. **Statistika:** 4 kategorije (Strijelci, Vratari, Isključenja, Crveni), M/Ž odvojeno, rangirane liste s imenima; **najbolji strijelac automatski**, **najbolji igrač turnira — bira organizator (ručno)**.
6. **Live tijek utakmice:** veliki rezultat + tijek minuta-po-minutu (gol/obrana/crveni/isključenje, igrač, tekući rezultat); tabovi Tijek/Sastavi/Statistika; dijeljenje.
7. **Detalj ekipe (= info o protivniku):** zaglavlje u boji ekipe (grupa, pozicija, bodovi, omjer), tabovi Sastav/Utakmice; sastav s kapetanom + trener; rezultati na turniru.
8. **Info:** O klubu, O turniru, **mapa-pregled s pinovima** + popis lokacija i **svih hotela** (svaki „Karta" → otvara Google/Apple Maps navigaciju na koordinate); pravila.
9. **Galerija:** fotke grupirane po danima, tap za pregled + dijeljenje.
10. **Pretraga:** igrači / ekipe / termini.
11. **Obavijesti — postavke:** glavni prekidač + biranje po tipu: „moja ekipa igra za X min", „gol moje ekipe", „kraj utakmice", „promjena satnice/termina", „program i večere". + upravljanje praćenim ekipama (više njih).
12. **Praćenje ekipe / „moja ekipa"** kao personalizirani kontekst.

## Admin funkcije (mobilni + web)
- **Login (skriveni ulaz):** email+lozinka ili magic-link; pristup samo delegati/organizacija.
- **Nadzorna ploča:** utakmica u tijeku + „nastavi unos", brojke (ekipe, odigrano, sponzori), brze akcije, „za odraditi".
- **Postavke / Turnir:** format + bodovanje; **trajanje utakmice** + **razmak**; **DANI TURNIRA** — dodaju se preko **„+ Dodaj dan" → skočni kalendar** (biraš datum i godinu, app sam ispiše dan u tjednu; bez posebnog naziva); **početak prve utakmice zasebno po danu**.
- **Auto-satnica:** „Generiraj satnicu" → app poreda sve utakmice i dodijeli vremena (trajanje + razmak + početak po danu). **Uredivo ručno.** Kod kašnjenja uživo — sve kasnije utakmice se pomiču automatski + push „promjena satnice".
- **Ekipe i igrači:** M/Ž; dodaj ekipu; naziv, **e-mail predstavnika**, boja/grb; sastav (broj, ime, kapetan), trener.
- **Sponzori:** zlatni sponzor (prekidač + velika kartica) + ostali (logo + razina: srebrni/brončani/partner); upload logotipa.
- **Unos uživo (zapisničar):** rezultat + ručna korekcija; izbor događaja (Gol/Obrana/Crveni/Isklj.); lista igrača s „+" (tap upiše događaj; gol diže rezultat + upiše strijelca); zadnji događaji + „poništi zadnje"; Počni/Završi (veže satnicu); provjera boja dresova; TV mod.
- **Obavijesti:** ručno slanje (Svi / po ekipi / pratitelji) + povijest; **automatski podsjetnici** (dan prije 18:00, 30 min prije, kod promjene satnice).
- **Promo:** **QR plakat** (za ispis) + **auto-objava za mreže** (app složi sliku rezultata s grbovima/lentom/logom/sponzorom nakon svake utakmice).
- **Prijave:** odobravanje prijavljenih ekipa (čekaju/odobrene), predstavnik + e-mail + broj igrača, Odobri/Odbij.
- **TV / semafor mod:** veliki rezultat preko cijelog ekrana za projektor (i na mobilnom i na webu).

## Logika natjecanja (za `packages/core`)
- **Auto-satnica:** ulaz = lista dana (datum + početak prve utakmice po danu), trajanje utakmice, razmak, redoslijed utakmica. Izlaz = svakoj utakmici dodijeljeno vrijeme početka. Kašnjenje uživo → pomak svih kasnijih + event „promjena satnice".
- **Bodovanje:** pobjeda 2, neriješeno 1, poraz 0. Sortiranje ljestvice: bodovi → gol-razlika → postignuti golovi. Prve 2 prolaze u završnicu.
- **Bracket:** polufinala (A1–B2, A2–B1), finale, utakmica za 3. mjesto.
- **Statistika:** agregira se iz događaja unesenih uživo (golovi po igraču → strijelci; obrane → vratari; itd.). Najbolji igrač = ručno polje koje admin postavi.

## Platforme i troškovi (Faza 6)
- Apple Developer: $99/god. Google Play: $25 jednokratno. Supabase: free tier za početak. Domena: ~15 €/god.
- Računi se otvaraju na **klub/organizaciju**, **kasnije** (bliže objavi) — ne blokira razvoj.

> Detaljniji originalni opis (v3) je u `dizajn/specifikacija-original.md`.
