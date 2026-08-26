import { describe, expect, it } from 'vitest';
import { adjacentInDay, swapSlots, type SlotMatch } from './reorder';

const m = (id: string, day: string | null, order: number, time: string | null = null): SlotMatch => ({
  id,
  day_id: day,
  sort_order: order,
  scheduled_time: time,
});

// Namjerno izmiješan redoslijed u polju: susjed se traži po sort_order,
// ne po tome kako su utakmice slučajno došle iz baze.
const day1 = [m('c', 'd1', 2), m('a', 'd1', 0), m('b', 'd1', 1)];

describe('adjacentInDay', () => {
  it('nalazi prethodnu po redoslijedu igranja', () => {
    expect(adjacentInDay(day1, 'b', 'up')?.id).toBe('a');
  });

  it('nalazi sljedecu po redoslijedu igranja', () => {
    expect(adjacentInDay(day1, 'b', 'down')?.id).toBe('c');
  });

  it('prva utakmica dana nema nikoga iznad sebe', () => {
    expect(adjacentInDay(day1, 'a', 'up')).toBeNull();
  });

  it('zadnja utakmica dana nema nikoga ispod sebe', () => {
    expect(adjacentInDay(day1, 'c', 'down')).toBeNull();
  });

  it('ne prelazi u drugi dan', () => {
    const two = [m('a', 'd1', 0), m('b', 'd2', 0)];
    expect(adjacentInDay(two, 'a', 'down')).toBeNull();
    expect(adjacentInDay(two, 'b', 'up')).toBeNull();
  });

  it('utakmica bez dana nema susjeda', () => {
    expect(adjacentInDay([m('x', null, 0)], 'x', 'up')).toBeNull();
  });

  it('nepoznat id ne rusi nista', () => {
    expect(adjacentInDay(day1, 'nema-me', 'up')).toBeNull();
  });

  it('isti sort_order se razrjesava stabilno, bez preskakanja', () => {
    const tied = [m('b', 'd1', 0), m('a', 'd1', 0)];
    expect(adjacentInDay(tied, 'b', 'up')?.id).toBe('a');
    expect(adjacentInDay(tied, 'a', 'down')?.id).toBe('b');
  });
});

describe('swapSlots', () => {
  it('zamjenjuje i mjesto u redu i termin', () => {
    const a = m('a', 'd1', 0, '2026-06-06T10:00:00+02:00');
    const b = m('b', 'd1', 1, '2026-06-06T10:20:00+02:00');
    expect(swapSlots(a, b)).toEqual([
      { id: 'a', sort_order: 1, scheduled_time: '2026-06-06T10:20:00+02:00' },
      { id: 'b', sort_order: 0, scheduled_time: '2026-06-06T10:00:00+02:00' },
    ]);
  });

  it('radi i kad jedna utakmica nema termin', () => {
    const [pa, pb] = swapSlots(m('a', 'd1', 0, '2026-06-06T10:00:00+02:00'), m('b', 'd1', 1, null));
    expect(pa.scheduled_time).toBeNull();
    expect(pb.scheduled_time).toBe('2026-06-06T10:00:00+02:00');
  });

  it('zamjena dva puta vraca na pocetno stanje', () => {
    const a = m('a', 'd1', 0, 'T10');
    const b = m('b', 'd1', 1, 'T11');
    const [p1, p2] = swapSlots(a, b);
    const back = swapSlots({ ...a, ...p1 }, { ...b, ...p2 });
    expect(back[0]).toEqual({ id: 'a', sort_order: 0, scheduled_time: 'T10' });
    expect(back[1]).toEqual({ id: 'b', sort_order: 1, scheduled_time: 'T11' });
  });
});
