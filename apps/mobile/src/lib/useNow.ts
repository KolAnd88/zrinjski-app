import { useEffect, useState } from 'react';

/**
 * Trenutno vrijeme koje se osvježava svakih `ms` dok je `active`.
 *
 * Sat utakmice se računa iz stanja u bazi (core/clock), pa ekranu treba samo
 * "sada" koje kucka — ne brojač koji bi se razišao od zapisničareva.
 */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}
