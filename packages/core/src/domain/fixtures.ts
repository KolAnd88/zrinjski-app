// fixtures.ts — generiranje rasporeda parova (round-robin) unutar grupe.
//
// Svaka ekipa igra sa svakom jednom (jednostruki round-robin), "circle" metodom.
// Izlaz = uređena lista parova [home, away] u redoslijedu kola — pogodno za sort_order.
// Dom/gost se izmjenjuje po kolima radi ravnoteže.

const BYE = '__BYE__';

export type Pairing = { home: string; away: string };

/**
 * Round-robin parovi za zadane ekipe.
 * < 2 ekipe → prazno. Neparan broj → jedna ekipa "pauzira" u svakom kolu.
 */
export function roundRobinPairings(teamIds: string[]): Pairing[] {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 !== 0) ids.push(BYE);

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const arr = ids.slice();
  const out: Pairing[] = [];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]!;
      const b = arr[n - 1 - i]!;
      if (a === BYE || b === BYE) continue;
      // Izmjena domaćina po kolima radi ravnoteže.
      out.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    // Rotiraj sve osim prvog elementa.
    const fixed = arr[0]!;
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return out;
}

/** Broj utakmica u jednostrukom round-robinu za n ekipa = n*(n-1)/2. */
export function roundRobinCount(teamCount: number): number {
  return teamCount < 2 ? 0 : (teamCount * (teamCount - 1)) / 2;
}
