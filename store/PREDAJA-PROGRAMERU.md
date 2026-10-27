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

### Mjere i format — provjereno u samim datotekama

Play odbija učitavanje ako format ne odgovara, pa je svaka datoteka
provjerena čitanjem PNG zaglavlja, ne na oko.

| Datoteka | Traži se | Jest |
|---|---|---|
| Ikona | 512×512, **32-bitni PNG s alfom**, do 1024 KB | 512×512, RGBA, 235 KB ✔ |
| Naslovna | 1024×500, **24-bitni PNG bez alfe** | 1024×500, RGB ✔ |
| Snimke telefon | bez alfe, strana 320–3840 px | 1125×2001, RGB ✔ |
| Snimke 7" | isto | 1200×1920, RGB ✔ |
| Snimke 10" | isto | 1600×2560, RGB ✔ |

> **Omjer je zamka.** Google traži da duža strana snimke **ne bude više od
> dvostruke kraće**. Gornje snimke su 16:9 i 16:10, pa prolaze. Ali sirova
> snimka s današnjeg telefona često je 1080×2400 (20:9 = 2,22:1) i Play je
> **odbija** — takvu treba obrezati na najviše 1080×2160.

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

> **Lozinka tog računa ne smije doći u ovu datoteku.** Repozitorij
> `KolAnd88/zrinjski-app` je **javan**, pa bi je vidio svatko, a povijest
> gita pamti i ono što se poslije izbriše. Lozinka ide samo na dva mjesta:
> u polje *App access* u Play konzoli i u `zrinjski-tajne.txt` izvan
> repozitorija. Programeru se šalje porukom, ne kroz git.

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
10" 1600×2560), sve u omjeru koji Play prihvaća. **Ali su samo zamjena za
prave**, iz dva razloga, oba pošteno rečena:

1. **Glavni ekrani su prazni.** Satnica još nije unesena, pa „Raspored" i
   „Statistika" pokazuju poruku da podataka nema, a početna pokazuje 0
   utakmica i 0 golova. Upotrebljivi su samo „Poredak" (6 prijavljenih ekipa
   s grbovima) i „Info".
2. **Natpisi u donjoj traci su odrezani** pri dnu. Slike su snimljene iz web
   verzije aplikacije, a odrezivanje je razlika u njezinu prikazu; na pravom
   telefonu natpisi su cijeli.

**Prave snimke se rade s telefona**, ne iz web verzije — tako nestaju oba
problema. Potrebno je najmanje dvije, Play dopušta do osam. Tablet snimke
nisu obavezne; bez njih Play samo upiše napomenu u listu zadataka.

Snimke se u konzoli **mijenjaju kad se želi, bez nove objave aplikacije** i
bez novog pregleda. Zato one ne smiju zadržati predaju: učitaju se ove, a
zamijene se čim postoje bolje.

## 7. Dodatna polja koja se lako preskoče

| Polje | Vrijednost |
|---|---|
| Države i regije (u produkcijskoj objavi) | **Sve države** — u konzoli postoji kvačica „Select all". Ako se ništa ne označi, aplikacija nije dostupna nigdje. |
| Bilješke o izdanju (Release notes, `hr-HR`) | *Prva verzija. Raspored, rezultati uživo, poredak, statistika, sastavi i obavijesti s turnira Ponos Hercegovine 2026.* |
| Oblik objave | **Produkcija** (ne zatvoreno testiranje) — publika je šira javnost. |

> **Zašto sve države.** Na turniru su ekipe iz BiH, Hrvatske i Srbije, a
> rodbina igrača je po Njemačkoj, Austriji, Švicarskoj i Švedskoj. Ako
> aplikacija nije dostupna u nekoj državi, ljudi je tamo **ne mogu ni
> pronaći** u trgovini, ne samo skinuti. Dostupnost je besplatna, pa se
> označava sve i nikoga nismo propustili.
>
> Dostupnost nije isto što i jezik: aplikacija je na hrvatskom i engleskom i
> takva ostaje gdje god bila dostupna.

## 8. Redoslijed u konzoli

Play ne pušta objavu dok svaki zadatak s popisa nije zelen. Redom:

1. Postavke trgovine — kategorija, kontakt, politika privatnosti
2. Glavni unos u trgovini — naziv, opisi, ikona, naslovna, snimke
3. Sigurnost podataka (`store/sigurnost-podataka.md`)
4. Ocjena sadržaja — upitnik
5. Ciljana publika i sadržaj
6. Pristup aplikaciji — **račun za recenzenta** (poglavlje 4a)
7. Oglasi — „Ne"
8. Nova objava u produkciji — `.aab`, države, bilješke o izdanju
9. Pošalji na pregled

Aplikacija se u međuvremenu dijeli preko poveznice, pa turnir ne ovisi o
Playu:
`https://github.com/KolAnd88/zrinjski-app/releases/latest/download/app.apk`
