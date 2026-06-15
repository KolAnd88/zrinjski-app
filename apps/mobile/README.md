# apps/mobile (Faza 3 + 4)

Expo (React Native + TypeScript) — korisnička aplikacija **i** mobilni admin u jednoj app.

Još nije inicijalizirano. Kreira se u Fazi 3 (admin) pa Fazi 4 (korisnička app):

```bash
npx create-expo-app@latest apps/mobile --template
```

Koristi dijeljene pakete iz monorepa:
- `@zrinjski/core` — Supabase klijent, tipovi, domenska logika (satnica/bodovanje/bracket/statistika)
- `@zrinjski/ui-tokens` — dizajn tokeni

Supabase klijent (Expo) — proslijedi AsyncStorage:

```ts
import { createZrinjskiClient } from '@zrinjski/core';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createZrinjskiClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  authStorage: AsyncStorage,
  detectSessionInUrl: false,
});
```
