# Sigurnost podataka — odgovori za Google Play

Obrazac „Data safety" u Play konzoli. Odgovori su izvedeni iz politike
privatnosti na `https://admin.ponoshercegovine.com/privatnost` i provjereni
u shemi baze. Ako se jedno promijeni, mijenja se i drugo.

## Uvodna pitanja

| Pitanje | Odgovor |
|---|---|
| Skuplja li aplikacija podatke korisnika? | **Da** |
| Dijele li se podaci s trećima? | **Ne** |
| Šifriraju li se podaci u prijenosu? | **Da** |
| Može li korisnik zatražiti brisanje podataka? | **Da** |
| Adresa za brisanje | `https://admin.ponoshercegovine.com/brisanje-racuna` |

**Zašto „Ne" na dijeljenje:** Supabase, Expo, Google i Netlify obrađuju
podatke u naše ime, kao pružatelji usluge. Google u obrascu izričito kaže
da se to ne broji kao dijeljenje s trećima.

## Što se skuplja

### Osobni podaci → Ime

- Skuplja se: **da**, dijeli: ne
- Obavezno (ne može se preskočiti)
- Svrha: **funkcionalnost aplikacije**
- Povezano s korisnikom: **da**
- Odnosi se na predstavnike ekipa i igrače koje oni prijave.

### Osobni podaci → Adresa e-pošte

- Skuplja se: **da**, dijeli: ne
- Obavezno
- Svrha: **funkcionalnost aplikacije**, **upravljanje računom**
- Povezano s korisnikom: **da**
- Samo predstavnici ekipa i organizatori. Gledatelji nemaju račun.

### Fotografije i videozapisi → Fotografije

- Skuplja se: **da**, dijeli: ne
- Neobavezno
- Svrha: **funkcionalnost aplikacije**
- Povezano s korisnikom: **ne**
- Galeriju puni organizacija turnira.

### Identifikatori uređaja → Identifikatori uređaja ili drugi ID-evi

- Skuplja se: **da**, dijeli: ne
- Neobavezno
- Svrha: **funkcionalnost aplikacije**
- Povezano s korisnikom: **ne**
- Oznaka uređaja za slanje obavijesti (Expo push token). Bez nje obavijest
  nema kamo stići. Ne koristi se za oglašavanje ni za praćenje.

## Što se NE skuplja

Lokacija, podaci o plaćanju, zdravstveni podaci, kontakti, poruke,
povijest pretraživanja, podaci o oglasima. Aplikacija nema oglase ni
kupnju unutar aplikacije.

## Ostali obrasci

**Ocjena sadržaja:** nema nasilja, seksualnog sadržaja, psovki, kockanja
ni kupnje. Aplikacija je sportski raspored.

**Publika:** odrasli. Nije namijenjena djeci, pa se ne primjenjuju
pravila za obitelji.

**Oglasi:** aplikacija **ne sadrži oglase**. Sponzori kluba prikazuju se
kao dio sadržaja turnira, ne kao oglasna mreža.
