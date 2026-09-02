// realtime.ts — primjena JEDNE promjene iz Supabase Realtimea na lokalni popis.
//
// Zašto uopće postoji: dosad je svaki realtime događaj pokretao PONOVNO
// PREUZIMANJE cijelog popisa utakmica i događaja. Na kraju turnira to je
// ~780 KB po golu, i to na SVAKOM spojenom telefonu — dakle preko mobilnog
// interneta gledatelja. Sat praćenja bio bi 20–25 MB tuđeg prometa, uz
// ponovno crtanje cijelog popisa svakih nekoliko sekundi.
//
// Supabase u samoj poruci već šalje promijenjeni redak. Primjenom te poruke
// isti posao stane u ~300 bajta.
//
// Kad se promjena NE može pouzdano primijeniti, funkcija to kaže (`refetch`)
// umjesto da nagađa — pozivatelj tada povuče puni popis. Bolje jedno suvišno
// preuzimanje nego tiho krivi rezultat na ekranu.

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

/** Poruka iz Realtimea, svedena na ono što je ovdje potrebno. */
export type RowChange<T> = {
  eventType: ChangeType | string;
  new?: Partial<T> | null;
  old?: Partial<T> | null;
};

export type ApplyResult<T> =
  | { kind: 'ok'; rows: T[] }
  /** Promjena se ne može primijeniti — povuci puni popis. */
  | { kind: 'refetch'; reason: 'nepoznat_tip' | 'nema_id' | 'nepotpun_redak' };

export type ApplyOptions<T> = {
  /**
   * Pripada li redak ovom popisu (npr. utakmica ovog turnira). Redak koji ne
   * pripada se ne dodaje, a ako je već bio na popisu — miče se.
   */
  belongs?: (row: T) => boolean;
  /** Poredak popisa. Bez ovoga novi redak ide na kraj. */
  sort?: (a: T, b: T) => number;
  /**
   * Polja bez kojih redak nije upotrebljiv. Ako ijedno nedostaje, radije se
   * traži puno osvježavanje nego da se na ekran stavi pola retka.
   */
  required?: (keyof T)[];
};

function potpun<T extends object>(row: Partial<T>, required?: (keyof T)[]): row is T {
  if (!required || required.length === 0) return true;
  return required.every((k) => row[k] !== undefined);
}

/**
 * Primijeni jednu promjenu na popis. Ulazni popis se ne mijenja — vraća se novi.
 */
export function applyChange<T extends { id: string }>(
  rows: T[],
  change: RowChange<T>,
  opts: ApplyOptions<T> = {}
): ApplyResult<T> {
  const { belongs, sort, required } = opts;
  const poredaj = (xs: T[]) => (sort ? [...xs].sort(sort) : xs);

  if (change.eventType === 'DELETE') {
    // Tablice imaju REPLICA IDENTITY FULL, pa `old` nosi cijeli stari redak.
    const id = change.old?.id;
    if (!id) return { kind: 'refetch', reason: 'nema_id' };
    return { kind: 'ok', rows: rows.filter((r) => r.id !== id) };
  }

  if (change.eventType !== 'INSERT' && change.eventType !== 'UPDATE') {
    return { kind: 'refetch', reason: 'nepoznat_tip' };
  }

  const novi = change.new;
  if (!novi?.id) return { kind: 'refetch', reason: 'nema_id' };
  if (!potpun<T>(novi, required)) return { kind: 'refetch', reason: 'nepotpun_redak' };

  const red = novi as T;

  // Redak koji više ne pripada ovom popisu (npr. utakmica prebačena u drugi
  // turnir) mora nestati, a ne ostati kao duh.
  if (belongs && !belongs(red)) {
    const bez = rows.filter((r) => r.id !== red.id);
    return { kind: 'ok', rows: bez.length === rows.length ? rows : bez };
  }

  const i = rows.findIndex((r) => r.id === red.id);
  if (i >= 0) {
    // INSERT poznatog retka se događa kad Realtime ponovi poruku — zamjena je
    // ispravna i za INSERT i za UPDATE.
    const kopija = [...rows];
    kopija[i] = red;
    return { kind: 'ok', rows: poredaj(kopija) };
  }

  // UPDATE retka koji nemamo (npr. stigao dok je app spavao) — dodajemo ga,
  // jer poruka nosi cijeli redak.
  return { kind: 'ok', rows: poredaj([...rows, red]) };
}
