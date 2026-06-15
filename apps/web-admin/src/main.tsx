import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // bazni stilovi prvi → stranice ih mogu nadjačati
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
