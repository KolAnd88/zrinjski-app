# apps/web-admin (Faza 3)

React (Vite) + TypeScript — web admin za zapisničara (laptop, 1280×800). Pokreće TV/semafor mod na projektoru.

Još nije inicijalizirano. Kreira se u Fazi 3:

```bash
npm create vite@latest apps/web-admin -- --template react-ts
```

Koristi dijeljene pakete iz monorepa:
- `@zrinjski/core` — Supabase klijent, tipovi, domenska logika
- `@zrinjski/ui-tokens` — dizajn tokeni

Supabase klijent (web) — koristi default storage (localStorage):

```ts
import { createZrinjskiClient } from '@zrinjski/core';

export const supabase = createZrinjskiClient({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
```
