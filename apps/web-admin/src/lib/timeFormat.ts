// timeFormat.ts — pomoć za Postgres `time` ↔ "HH:MM" u <input type="time">.

/** Postgres time ("10:00:00" ili "10:00") → "HH:MM" za input. null/'' → ''. */
export function toInputTime(t: string | null | undefined): string {
  if (!t) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return '';
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

/** "HH:MM" iz inputa → vrijednost za spremanje (ili null ako prazno). */
export function fromInputTime(v: string): string | null {
  return v.trim() ? v.trim() : null;
}

/**
 * Vrijeme "HH:MM" iz ISO timestampa (core sprema lokalno vrijeme s eksplicitnim
 * offsetom, npr. "2026-07-10T18:00:00+02:00"). Slicea satnicu iz stringa pa je
 * neovisno o vremenskoj zoni preglednika. null/'' → ''.
 */
export function isoToLocalHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : '';
}
