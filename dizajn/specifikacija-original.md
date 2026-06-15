# Specifikacija — Turnirska aplikacija (glavni dokument, v3)

> Jedan turnir, generička i potpuno konfigurabilna kroz Admin. Gradimo SVE odjednom (bez faza isporuke).
> Prva upotreba: VHMRK Zrinjski Mostar (veterani, rukomet), muški + ženski.

## 0. Ključne postavke turnira
- **Jedna dvorana**: Bijeli Brijeg, Mostar.
- **Jedna utakmica u isto vrijeme**, igra se redom (slijedni raspored — nema paralelnih terena).
- Muška i ženska konkurencija (odvojene grupe, ljestvice, statistike).
- Format: grupe → završnica; sve se konfigurira u adminu.
- Jezici: hrvatski + engleski.
- Besplatno za korisnike. Distribucija: Google Play + Apple App Store.
- **Nema**: provjere godišta, potpisa zapisnika, hitnih info, kotizacije.

## 1. Uloge
| Uloga | Pristup | Ukratko |
|------|---------|--------|
| Gledatelj/navijač | bez logina | prati sve, prati uživo, prati ekipu |
| Igrač | (opcionalno login) | "moja ekipa", osobna statistika |
| Predstavnik ekipe | login (magic-link/Google) | upravlja svojim sastavom, komunicira s organizacijom |
| Admin / delegat | login | konfigurira sve i unosi rezultate uživo |

## 2. Gledatelj / navijač
- Početna: hero + dijagonalna crvena lenta, countdown do turnira, UŽIVO kartica, sljedeće na rasporedu, zlatni sponzor + ostali, zabavni program.
- Raspored (po danima), Poredak (grupe + ispod svake raspored i rezultati, pa Završnica), Statistika (strijelci, vratari, isključenja, crveni; M/Ž), Galerija, Info (**O klubu**, **O turniru**, dvorana, hoteli, završna večera — lokacije na karti; program; prijava predstavnika).
- **Praćenje ekipe**: označi omiljenu → push kad igra, kad zabije, kad se promijeni termin.
- **Live tijek utakmice**: golovi i događaji po minutama, ne samo rezultat.
- **"Sada se igra"**: brzi pregled tekuće utakmice.
- Tap na ekipu → sastav (igrači + trener).
- Dijeljenje rezultata/tablice na društvene mreže.
- Cijeli kalendar turnira (utakmice + DJ večeri + svečana večera); dodaj u kalendar telefona.

## 3. Igrač
- **"Moja ekipa"** kao personalizirani ekran: sljedeća utakmica, odbrojavanje, protivnik + njihov sastav i rezultati.
- Osobna statistika kroz turnir i kroz godine (arhiva).
- Ciljana obavijest "tvoja utakmica za 30 min".
- Svoje fotke lako naći (galerija po ekipi/utakmici).

## 4. Predstavnik ekipe
- Upravljanje sastavom: dodaj/ukloni igrača, kapetan, oznaka tko dolazi; popis se **zaključa** na rok.
- Brza poruka organizatoru iz aplikacije.
- Ciljani push na svaku promjenu rasporeda/termina svoje ekipe.
- Dijeljenje pozivnice suigračima (skini app, prati ekipu).
- Pregled svih obveza ekipe (utakmice + društveni program).

## 5. Admin (sve konfigurabilno)
**Postavke**: naziv, datumi, logo, boje, jezici (HR/EN), hero, pravila, branding, tekstovi O klubu i O turniru (sa slikom).
**Format**: grupe (M i Ž), broj ekipa, oblik završnice.
**Prijave**: online prijava ekipe → admin odobrava.
**Ekipe/igrači**: po spolu; predstavnici imaju e-mail za login.
**Raspored**: auto-generiranje slijednog rasporeda (jedna dvorana, dovoljno odmora između dvije utakmice iste ekipe) ili ručno; auto-konstrukcija završnice iz poretka (Pobjednik PF1…, utakmica za 3. mjesto).
**Tijek utakmice**: gumb "počela/gotova"; unos golova (strijelci), obrana, crvenih, isključenja uživo (realtime gledateljima).
**Auto-satnica**: bilježi stvarno vrijeme početka; ako kasni, automatski pomiče sve iduće utakmice za iznos kašnjenja + push obavijest; admin može ručno korigirati.
**Obavijesti**: ciljani push (svima / jednoj ekipi / pojedincu).
**Upozorenja**: sudar boja dresova prije utakmice.
**Sponzori**: upload logotipa + razina (zlatni/srebrni/brončani); zlatni kao velika reklama na vrhu.
**Lokacije**: dvorana, hoteli, restoran (završna večera) s koordinatama.
**Program**: zabavni program (DJ, večera, razgledavanje).
**Galerija, nagrade** (strijelac/vratar/najbolji igrač — auto + ručno), **arhiva** po godinama.
**Više admina/delegata** koji istovremeno unose; **povijest izmjena rezultata** (tko/što/kad).

## 5b. Dodatne značajke (dogovoreno — organizatorski paket)
1. **TV / semafor mod** — veliki prikaz rezultata, poluvremena i odbrojavanja za TV/projektor u dvorani (vodi se iz istog unosa uživo, dvorana ne treba zaseban semafor).
2. **Automatski podsjetnici** — push se šalje sam, bez tipkanja: dan prije (npr. 18:00), 30 min prije utakmice, i kod promjene termina/satnice. Konfigurabilno (uključi/isključi po tipu).
3. **Auto objava za mreže** — nakon svake utakmice app sam složi gotovu sliku rezultata (grb ekipa, rezultat, logo sponzora, branding turnira) za Facebook/Instagram; jedan tap → podijeljeno.
4. **QR plakat** — app generira QR za skidanje aplikacije + plakat spreman za ispis (dvorana, šator).
5. **Vizualni bracket završnice** — grafički kostur: polufinala → FINALE → utakmica za 3. mjesto; svima odmah jasno tko s kim igra. Auto se puni iz poretka i rezultata.

## 6. Tehnički zahtjevi
- **Offline rad + sinkronizacija** kad se vrati signal (wifi u dvorani zna pasti) — kritično za unos.
- Realtime prikaz rezultata gledateljima.
- React Native (Expo) iOS+Android; React web admin; Supabase (baza, login/magic-link, upload, realtime); push (Expo/FCM); karte preko deep-linkova (Google/Apple).

## 7. Skica baze (glavne tablice)
```
tournaments  (naziv, datumi, logo, boje, jezici, hero, pravila, status)
groups       (tournament_id, spol, naziv)
teams        (tournament_id, group_id, spol, naziv, logo, boja, trener, odobrena)
players      (team_id, spol, broj, ime, prezime, kapetan, dolazi)
team_reps    (team_id, email)
matches      (tournament_id, group_id, spol, faza, home, away, plan_vrijeme,
              real_start, kasnjenje_min, rez_home, rez_away, status)
match_events (match_id, team_id, player_id, tip[gol|obrana|crveni|iskljucenje], minuta)
result_log   (match_id, admin_id, promjena, vrijeme)        -- povijest izmjena
awards       (tournament_id, spol, tip, player_id)
venues       (tip[dvorana|hotel|restoran], naziv, adresa, lat, lng)
sponsors     (naziv, logo, razina)
events       (naziv, opis, vrijeme, venue_id)               -- zabavni program
gallery      (slika, opis, datum, team_id?, match_id?)
follows      (uredaj/korisnik, team_id)                     -- praćenje ekipe
admins       (email, uloga[glavni|delegat|urednik])
```

## 8. Prioriteti (gradimo sve, ovo je redoslijed izrade)
**Jezgra**: format/ekipe/igrači, raspored + auto-satnica, unos uživo + realtime, ljestvice/statistika, offline+sync, više admina, povijest izmjena.
**Angažman**: praćenje ekipe + ciljane obavijesti, live tijek, "moja ekipa", predstavnici sami unose sastav, poruka organizatoru.
**Sadržaj/organizacija**: sponzori (+kasnije analitika), program, lokacije/karte, galerija, prijava ekipa.
**Završno**: nagrade + diplome, izvoz PDF/Excel + objava za mreže, engleski, uloge admina + backup, arhiva po godinama.

## 9. Troškovi (native)
Apple 99 USD/god · Google 25 USD jednokratno · domena ~15 €/god (opc.) · Supabase 0 € (free tier u startu).
