# Napraviti APK za testere (Android)

APK se gradi u Expo oblaku (EAS Build). Rezultat je `.apk` datoteka/link koji
pošalješ ljudima da instaliraju na Android telefon — bez Expo Go i bez Trgovine.

## 1. Napravi besplatni Expo račun
- Idi na https://expo.dev → **Sign Up** (može GitHub/Google).

## 2. U terminalu (mapa mobilne app)
```
cd C:\Users\pc\Desktop\zrinjski-app\apps\mobile
npx eas-cli@latest login
```
Upiši e-mail/lozinku Expo računa.

## 3. Poveži projekt (jednom)
```
npx eas-cli@latest init
```
- Potvrdi kreiranje projekta (Enter/Yes). Ovo upiše „projectId" u `app.json`.

## 4. Pokreni build APK-a
```
npx eas-cli@latest build -p android --profile preview
```
- Ako pita za **Android keystore** → odgovori **Yes** (Expo sam generira i čuva potpis).
- Build ide u oblak: traje ~10–20 min. Možeš zatvoriti terminal; link dobiješ i na expo.dev.

## 5. Podijeli testerima
- Kad build završi, terminal (i stranica na expo.dev → Builds) daju **link** i **QR**.
- Pošalji link testerima (WhatsApp/e-mail/Viber). Na Androidu:
  1. otvore link → **Download** .apk
  2. kod instalacije Android pita za **„Instaliranje iz nepoznatih izvora"** → dopuste
  3. instaliraju i otvore „VHMRK Zrinjski"
- APK je spojen na tvoju **živu bazu** (vide prave podatke + realtime).

## Napomene
- **iPhone ne može instalirati APK** — za iOS treba TestFlight (poseban postupak, kasnije).
- Svaka nova verzija = ponovni `build` pa novi link (stari APK se ne osvježava sam).
- Besplatni EAS plan ima red čekanja za buildove — ponekad pričeka koju minutu.
- Ako build pukne (monorepo), prepiši grešku — sitna prilagodba i ide dalje.
