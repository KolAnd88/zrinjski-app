import { describe, expect, it } from 'vitest';
import { applyChange, type RowChange } from './realtime';

type Red = { id: string; tournament_id: string; sort_order: number; home_score: number };

const red = (id: string, sort: number, score = 0): Red => ({
  id,
  tournament_id: 'T',
  sort_order: sort,
  home_score: score,
});

const POPIS = [red('a', 0), red('b', 1), red('c', 2)];
const OPCIJE = {
  belongs: (r: Red) => r.tournament_id === 'T',
  sort: (a: Red, b: Red) => a.sort_order - b.sort_order,
  required: ['id', 'tournament_id', 'sort_order', 'home_score'] as (keyof Red)[],
};

const ok = (r: ReturnType<typeof applyChange<Red>>) => {
  if (r.kind !== 'ok') throw new Error(`ocekivan ok, dobiven refetch: ${r.reason}`);
  return r.rows;
};

describe('applyChange — izmjena', () => {
  it('mijenja postojeći redak na mjestu', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'UPDATE', new: red('b', 1, 5) }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(rows.find((r) => r.id === 'b')!.home_score).toBe(5);
  });

  it('ne dira ulazni popis', () => {
    const prije = JSON.stringify(POPIS);
    applyChange(POPIS, { eventType: 'UPDATE', new: red('b', 1, 9) }, OPCIJE);
    expect(JSON.stringify(POPIS)).toBe(prije);
  });

  it('gol na jednoj utakmici ne dira ostale retke', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'UPDATE', new: red('b', 1, 7) }, OPCIJE));
    expect(rows[0]).toBe(POPIS[0]);
    expect(rows[2]).toBe(POPIS[2]);
  });
});

describe('applyChange — dodavanje', () => {
  it('dodaje novi redak i drži poredak', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'INSERT', new: red('x', 1.5) }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'x', 'c']);
  });

  // Realtime zna ponoviti poruku; dvaput primijenjen INSERT ne smije udvostručiti.
  it('ponovljeni INSERT ne stvara duplikat', () => {
    const jednom = ok(applyChange(POPIS, { eventType: 'INSERT', new: red('x', 3) }, OPCIJE));
    const dvaput = ok(applyChange(jednom, { eventType: 'INSERT', new: red('x', 3) }, OPCIJE));
    expect(dvaput.filter((r) => r.id === 'x')).toHaveLength(1);
  });

  // App je spavao pa je propustio INSERT; kad stigne UPDATE, poruka nosi
  // cijeli redak, pa se smije dodati.
  it('UPDATE nepoznatog retka ga dodaje', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'UPDATE', new: red('z', 9) }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'z']);
  });
});

describe('applyChange — brisanje', () => {
  it('miče redak po starom id-u', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'DELETE', old: red('b', 1) }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('brisanje nepoznatog retka ne mijenja ništa', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'DELETE', old: red('nema', 0) }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  // Bez REPLICA IDENTITY FULL `old` ne bi imao id — tada se ne smije nagađati.
  it('brisanje bez id-a trazi puno osvjezavanje', () => {
    const r = applyChange(POPIS, { eventType: 'DELETE', old: {} }, OPCIJE);
    expect(r).toEqual({ kind: 'refetch', reason: 'nema_id' });
  });
});

describe('applyChange — tudi i nepotpuni retci', () => {
  it('redak iz drugog turnira se ne dodaje', () => {
    const tudi = { ...red('t', 0), tournament_id: 'DRUGI' };
    const rows = ok(applyChange(POPIS, { eventType: 'INSERT', new: tudi }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  // Utakmica prebacena u drugi turnir mora nestati, a ne ostati kao duh.
  it('redak koji je presao u drugi turnir se mice', () => {
    const preseljen = { ...red('b', 1), tournament_id: 'DRUGI' };
    const rows = ok(applyChange(POPIS, { eventType: 'UPDATE', new: preseljen }, OPCIJE));
    expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('nepotpun redak trazi puno osvjezavanje', () => {
    const r = applyChange(POPIS, { eventType: 'INSERT', new: { id: 'x', tournament_id: 'T' } }, OPCIJE);
    expect(r).toEqual({ kind: 'refetch', reason: 'nepotpun_redak' });
  });

  it('poruka bez id-a trazi puno osvjezavanje', () => {
    const r = applyChange(POPIS, { eventType: 'INSERT', new: { sort_order: 4 } }, OPCIJE);
    expect(r).toEqual({ kind: 'refetch', reason: 'nema_id' });
  });

  it('nepoznat tip poruke trazi puno osvjezavanje', () => {
    const r = applyChange(POPIS, { eventType: 'TRUNCATE' } as RowChange<Red>, OPCIJE);
    expect(r).toEqual({ kind: 'refetch', reason: 'nepoznat_tip' });
  });
});

describe('applyChange — bez opcija', () => {
  it('radi i kad nema poretka ni provjera', () => {
    const rows = ok(applyChange(POPIS, { eventType: 'INSERT', new: red('x', 0) }));
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'x']);
  });
});

describe('applyChange — niz promjena kao na utakmici', () => {
  it('deset golova daje ispravan konacan rezultat', () => {
    let rows = [red('m', 0, 0)];
    for (let i = 1; i <= 10; i++) {
      rows = ok(applyChange(rows, { eventType: 'UPDATE', new: red('m', 0, i) }, OPCIJE));
    }
    expect(rows).toHaveLength(1);
    expect(rows[0]!.home_score).toBe(10);
  });
});
