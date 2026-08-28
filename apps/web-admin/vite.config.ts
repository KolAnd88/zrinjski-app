// `defineConfig` iz vitest/config, ne iz vite: samo on poznaje ključ `test`.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Monorepo: @zrinjski/* paketi su TS izvor (main → src/index.ts).
// Isključujemo ih iz pre-bundlanja da Vite transpilira izvorni TS direktno.
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@zrinjski/core', '@zrinjski/ui-tokens'],
  },
  server: {
    port: 5173,
    fs: { allow: ['..', '../..'] },
  },
  // Testovi tokova admina: ždrijeb, spremanje na gumb i slično. Domenska
  // logika ostaje testirana u @zrinjski/core; ovdje se provjerava ono što
  // postoji samo u sučelju.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
