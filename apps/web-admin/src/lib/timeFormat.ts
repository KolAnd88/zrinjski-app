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
 * Vrijeme "HH:MM" iz ISO timestampa, u LOKALNOJ zoni preglednika.
 * VAŽNO: Postgres (timestamptz) vraća vremena u UTC — rezanje sata iz stringa
 * prikazivalo bi 2h krivo. Organizacija i turnir su u istoj zoni pa je lokalno točno.
 */
export function isoToLocalHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
