import { defineConfig } from 'vite';
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
});
