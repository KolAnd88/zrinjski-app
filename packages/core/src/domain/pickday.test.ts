import { describe, expect, it } from 'vitest';
import { pickCurrentDayId } from './schedule';

const days = [
  { id: 'd1', date: '2026-06-05' },
  { id: 'd2', date: '2026-06-06' },
  { id: 'd3', date: '2026-06-07' },
];

describe('pickCurrentDayId', () => {
  it('otvara današnji dan dok turnir traje', () => {
    expect(pickCurrentDayId(days, '2026-06-06')).toBe('d2');
  });

  it('prije turnira otvara prvi dan', () => {
    expect(pickCurrentDayId(days, '2026-05-30')).toBe('d1');
  });

  it('poslije turnira otvara zadnji dan', () => {
    expect(pickCurrentDayId(days, '2026-07-01')).toBe('d3');
  });

  it('u pauzi između dana otvara sljedeći', () => {
    const razmaknuti = [
      { id: 'a', date: '2026-06-05' },
      { id: 'b', date: '2026-06-09' },
    ];
    expect(pickCurrentDayId(razmaknuti, '2026-06-07')).toBe('b');
  });

  it('ne ovisi o redoslijedu u nizu', () => {
    const izmijesani = [days[2]!, days[0]!, days[1]!];
    expect(pickCurrentDayId(izmijesani, '2026-06-06')).toBe('d2');
  });

  it('bez dana vraća null', () => {
    expect(pickCurrentDayId([], '2026-06-06')).toBeNull();
  });
});
