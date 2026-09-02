import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { lentaCssVars } from '@zrinjski/ui-tokens';
import './index.css'; // bazni stilovi prvi → stranice ih mogu nadjačati
import { App } from './App';

// Lenta i za CSS površine dolazi iz zajedničke definicije. Bez ovoga su
// prijavni zasloni ostajali na vlastitim brojevima — i doista su ostali na
// starih -12° dok je sve ostalo već bilo ujednačeno.
for (const [k, v] of Object.entries(lentaCssVars())) {
  document.documentElement.style.setProperty(k, v);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
