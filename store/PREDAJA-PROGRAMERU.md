# Predaja za objavu na Google Play

Aplikacija **Ponos Hercegovine 2026** — službena aplikacija veteranskog
rukometnog turnira VHMRK Zrinjski Mostar, 5. – 8. studenoga 2026.

Objava ide preko postojećeg računa tvrtke, pa **ne treba** zatvoreno
testiranje s 12 testera ni čekanje od 14 dana. To vrijedi samo za nove
osobne račune.

---

## 1. Datoteke

| Što | Gdje |
|---|---|
| Paket za objavu | `ponos-hercegovine-1.1.4.aab` |
| Ikona 512×512 | `store/play-ikona-512.png` |
| Naslovna 1024×500 | `store/play-naslovna-1024x500.png` |
| Snimke zaslona | `store/snimke/telefon`, `/tablet-7`, `/tablet-10` |
| Tekstovi za trgovinu | `store/play-listing-hr.txt` (i `-en.txt`) |
| Odgovori o podacima | `store/sigurnost-podataka.md` |

## 2. Podaci o paketu

Provjereno čitanjem manifesta iz same `.aab` datoteke, ne iz konfiguracije.

| | |
|---|---|
| Naziv paketa | `ba.vhmrkzrinjski.app` |
| Verzija | `1.1.4` |
| Broj verzije (versionCode) | `7` |
| Minimalni Android | prema Expo SDK 57 |
| Veličina | 63 857 467 bajta |
| Reklamni identifikator (AD_ID) | **nema ga** — u manifestu ne postoji |

### Potpis

Paket je potpisan ključem koji čuva EAS (Expo). Otisak certifikata:

```
SHA-256: CF:C5:65:8F:81:6E:F7:A5:A8:8B:ED:79:76:C2:F1:20:C1:D9:51:3E:35:6F:FF:9B:0F:AE:29:97:87:34:C9:CA
```

Pri prvom učitavanju Play ovo registrira kao **ključ za učitavanje**
(upload key), a sam potpisuje aplikaciju za korisnike (Play App Signing).

> **Važno za kasnije:** svaka buduća nadogradnja mora biti potpisana istim
> ključem, dakle mora doći iz ovog istog EAS projekta
> (`koland88/vhmrk-zrinjski`, projectId `3503dd7b-7eff-4a62-81f0-904c7acbbb23`).
> Paket potpisan drugim ključem Play odbija.

## 3. Polja u Play konzoli

### Osnovno

| Polje | Vrijednost |
|---|---|
| Naziv aplikacije | `Ponos Hercegovine 2026` |
| Zadani jezik | hrvatski (Hrvatska) |
| Vrsta | Aplikacija (ne igra) |
| Kategorija | Sport |
| Cijena | besplatna |
| Kontakt e-pošta | `vhmrkzrinjski1994@gmail.com` |
| Politika privatnosti | `https://admin.ponoshercegovine.com/privatnost` |
| Brisanje računa | `https://admin.ponoshercegovine.com/brisanje-racuna` |

Kratki i puni opis su u `store/play-listing-hr.txt`, pripremljeni unutar
Googleovih ograničenja (naziv 22/30 znakova, kratki opis 70/80, puni 1541/4000).

### Deklaracije

| Pitanje | Odgovor |
|---|---|
| Sadrži li aplikacija oglase? | **Ne** |
| Kupnja unutar aplikacije? | **Ne** |
| Koristi li reklamni identifikator? | **Ne** (provjereno u manifestu) |
| Ciljana publika | odrasli, 18+ |
| Namijenjeno djeci? | Ne |
| Aplikacija s vijestima? | Ne |
| Vladina aplikacija? | Ne |
| Financijske značajke? | Ne |
| Zdravstvene značajke? | Ne |

Obrazac **Sigurnost podataka** ispunjen je polje po polje u
`store/sigurnost-podataka.md`. Ukratko: skupljaju se ime i e-pošta
predstavnika klubova, popisi igrača, fotografije s turnira i oznaka uređaja
za obavijesti. Ništa se ne dijeli s trećima; Supabase, Expo, Google FCM i
Netlify obrađuju podatke kao pružatelji usluge.

**Ocjena sadržaja:** nema nasilja, psovki, seksualnog sadržaja, kockanja ni
kupnje. Očekivano: 3+ ili PEGI 3.

## 4. Dvije stvari koje zaustavljaju objavu ako se preskoče

### a) Pristup aplikaciji (App access) — treba odluka

Play pita je li dio aplikacije iza prijave. **Jest.** Gledatelji ne trebaju
račun i vide sve — raspored, rezultate, poredak, statistiku. Ali postoje dva
zatvorena dijela:

- **Predstavnik kluba** — prijavljuje ekipu i unosi sastav
- **Organizator** — vodi utakmice uživo

Za te dijelove Google traži da se recenzentu ostavi račun za probu. Bez toga
zna odbiti objavu uz obrazloženje da nije mogao pregledati cijelu aplikaciju.

**Što treba napraviti:** Andrej otvara jedan račun predstavnika kluba u
aplikaciji („Ekipa" → „Otvori račun") i te podatke upisuje u konzoli pod
*App access → All or some functionality is restricted*. Uz njih kratka
uputa: „Prijava kroz Ekipa → Prijava predstavnika."

Račun neka ne bude ničiji stvarni — neka bude zaseban, napravljen samo za
pregled.

### b) Naziv paketa je konačan

`ba.vhmrkzrinjski.app` se nakon prve objave **više ne može promijeniti**.
Ako aplikacija ikad treba prijeći s računa tvrtke na račun kluba, to se radi
prijenosom aplikacije među računima, ne novom objavom.

## 5. Dozvole u manifestu

Ako recenzent pita, ovo su dozvole i čemu služe:

| Dozvola | Zašto |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | podaci i rezultati uživo |
| `POST_NOTIFICATIONS`, `VIBRATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, `c2dm.RECEIVE` | obavijesti o utakmicama (Expo + Firebase) |
| `READ/WRITE_EXTERNAL_STORAGE` | spremanje slike rezultata za dijeljenje |
| `SYSTEM_ALERT_WINDOW` | dolazi iz React Native okvira, aplikacija je ne koristi |
| dozvole za značke na ikoni (Samsung, Huawei, Sony, Oppo…) | brojač nepročitanih obavijesti, dolazi iz biblioteke |

## 6. Snimke zaslona — pročitati prije nego se učitaju

U `store/snimke` stoje slike u tri mjere (telefon 1125×2001, 7" 1200×1920,
10" 1600×2560), sve u omjeru koji Play prihvaća. **Ali nisu dobre.**

Dva razloga, oba pošteno rečena:

1. **Glavni ekrani su prazni.** Satnica još nije unesena, pa „Raspored" i
   „Statistika" pokazuju poruku da podataka nema, a početna pokazuje 0
   utakmica i 0 golova. Upotrebljivi su samo „Poredak" (6 prijavljenih ekipa
   s grbovima) i „Info".
2. **Natpisi u donjoj traci su odrezani** pri dnu. To je razlika u prikazu
   web verzije iz koje su slike snimljene; na pravom telefonu natpisi su
   cijeli.

**Preporuka:** učitati za sada „Poredak" i „Info" (Play traži najmanje dvije
snimke), a prave napraviti **s telefona tijekom turnira**, kad teče utakmica
uživo i kad se puni poredak i statistika. Snimke se u konzoli mijenjaju
kasnije bez nove objave aplikacije.

## 7. Što predlažem za objavu

Turnir je 5. – 8. studenoga. Pregled nove aplikacije na Playu zna trajati od
nekoliko dana do tjedan dana.

- **Ako se ide odmah u produkciju:** učitati sada, sa slabijim snimkama, pa
  ih zamijeniti nakon turnira.
- **Ako se ne žuri:** objaviti nakon turnira, s pravim snimkama. Aplikacija
  se za sam turnir ionako dijeli preko poveznice:
  `https://github.com/KolAnd88/zrinjski-app/releases/latest/download/app.apk`

Odluka je na klubu, nije tehnička.
