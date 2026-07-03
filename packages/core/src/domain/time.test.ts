import { describe, expect, it } from 'vitest';
import { addMinutesToTime, combineDateTime, formatDateHr, minutesToTime, timeToMinutes, weekdayHr } from './time';

describe('timeToMinutes / minutesToTime', () => {
  it('okrugli putevi', () => {
    expect(timeToMinutes('10:00')).toBe(600);
    expect(minutesToTime(600)).toBe('10:00');
    expect(minutesToTime(0)).toBe('00:00');
  });

  it('neispravan format baca grešku', () => {
    expect(() => timeToMinutes('25:00')).toThrow();
    expect(() => timeToMinutes('abc')).toThrow();
  });

  it('prelijevanje preko ponoći se omata', () => {
    expect(addMinutesToTime('23:50', 20)).toBe('00:10');
  });
});

describe('addMinutesToTime', () => {
  it('dodaje trajanje + razmak', () => {
    expect(addMinutesToTime('10:00', 20)).toBe('10:20');
    expect(addMinutesToTime('10:40', 20)).toBe('11:00');
  });
});

describe('weekdayHr / formatDateHr', () => {
  it('dan u tjednu se računa iz datuma (5.6.2026. je petak)', () => {
    expect(weekdayHr('2026-06-05')).toBe('petak');
    expect(weekdayHr('2026-06-07')).toBe('nedjelja');
  });

  it('format D.M.YYYY.', () => {
    expect(formatDateHr('2026-06-05')).toBe('5.6.2026.');
  });
});

describe('combineDateTime', () => {
  it('spaja datum + vrijeme + zonu u ISO', () => {
    expect(combineDateTime('2026-06-06', '10:00')).toBe('2026-06-06T10:00:00+02:00');
    expect(combineDateTime('2026-06-06', '10:00', 60)).toBe('2026-06-06T10:00:00+01:00');
  });
});
