import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Nacrt izmjena koji se sprema tek na gumb.
 *
 * Dosad je admin spremao svaku promjenu odmah — na `onBlur` ili `onChange`.
 * To znači da je krivi klik već zapisan, da se ne može odustati i da nema
 * trenutka u kojem korisnik potvrđuje što mijenja. Ovaj kuka drži izmjene u
 * nacrtu dok se ne pritisne "Spremi".
 *
 * Kad se izvana stignu novi podaci (osvježenje, realtime), nacrt se
 * osvježava SAMO ako korisnik nije ništa dirao — inače bi mu tuđa promjena
 * pobrisala nespremljeni rad ispod ruke.
 */
export type Draft<T> = {
  /** Trenutne vrijednosti u obrascu. */
  value: T;
  /** Promijeni jedno polje. */
  set: <K extends keyof T>(key: K, v: T[K]) => void;
  /** Ima li nespremljenih izmjena. */
  dirty: boolean;
  /** Sprema u tijeku. */
  saving: boolean;
  /** Poruka greške zadnjeg spremanja, ako ga je bilo. */
  error: string | null;
  /** Je li zadnje spremanje uspjelo (za kratku potvrdu). */
  saved: boolean;
  /** Spremi nacrt. Ne radi ništa ako nema izmjena. */
  save: () => Promise<void>;
  /** Vrati na zadnje poznato stanje iz baze. */
  reset: () => void;
};

export function useDraft<T extends Record<string, unknown>>(
  source: T,
  onSave: (changed: Partial<T>) => Promise<void>
): Draft<T> {
  const [value, setValue] = useState<T>(source);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Usporedba po sadržaju: `source` je gotovo uvijek novi objekt iz mreže,
  // pa bi usporedba po referenci resetirala obrazac na svako osvježenje.
  const sourceKey = JSON.stringify(source);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (dirtyRef.current) return;
    setValue(JSON.parse(sourceKey) as T);
  }, [sourceKey]);

  const set = useCallback(<K extends keyof T>(key: K, v: T[K]) => {
    setValue((old) => ({ ...old, [key]: v }));
    setDirty(true);
    setSaved(false);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setValue(JSON.parse(sourceKey) as T);
    setDirty(false);
    setError(null);
    setSaved(false);
  }, [sourceKey]);

  const save = useCallback(async () => {
    if (!dirtyRef.current || saving) return;
    // Šalje se samo ono što je stvarno promijenjeno — tako se ne gazi polje
    // koje je u međuvremenu netko drugi promijenio, a mi ga nismo ni dirali.
    const base = JSON.parse(sourceKey) as T;
    const changed: Partial<T> = {};
    for (const k of Object.keys(value) as (keyof T)[]) {
      if (JSON.stringify(value[k]) !== JSON.stringify(base[k])) changed[k] = value[k];
    }
    if (Object.keys(changed).length === 0) {
      setDirty(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(changed);
      setDirty(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [onSave, saving, sourceKey, value]);

  return useMemo(
    () => ({ value, set, dirty, saving, error, saved, save, reset }),
    [value, set, dirty, saving, error, saved, save, reset]
  );
}
