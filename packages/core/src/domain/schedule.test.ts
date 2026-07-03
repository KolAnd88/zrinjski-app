import { describe, expect, it } from 'vitest';
import { dayDurationMinutes, generateDaySchedule, generateSchedule, shiftDaySchedule, type DayInput } from './schedule';

const params = { matchDurationMin: 15, gapMin: 5 }; // korak = 20 min

const day: DayInput = {
  dayId: 'd1',
  date: '2026-06-06',
  firstMatchTime: '10:00',
  matchIds: ['m1', 'm2', 'm3'],
};

describe('generateDaySchedule', () => {
  it('prva utakmica u prvom terminu, svaka sljedeća +trajanje+razmak', () => {
    const out = generateDaySchedule(day, params);
    expect(out.map((s) => s.time)).toEqual(['10:00', '10:20', '10:40']);
    expect(out[0]!.scheduledTime).toBe('2026-06-06T10:00:00+02:00');
    expect(out[2]!.orderInDay).toBe(2);
  });

  it('dan bez vremena (samo druženje) ili bez utakmica → prazno', () => {
    expect(generateDaySchedule({ ...day, firstMatchTime: null }, params)).toEqual([]);
    expect(generateDaySchedule({ ...day, matchIds: [] }, params)).toEqual([]);
  });

  it('poštuje konfigurabilno trajanje/razmak', () => {
    const out = generateDaySchedule(day, { matchDurationMin: 20, gapMin: 10 });
    expect(out.map((s) => s.time)).toEqual(['10:00', '10:30', '11:00']);
  });
});

describe('generateSchedule (više dana)', () => {
  it('spaja termine svih dana', () => {
    const d2: DayInput = { dayId: 'd2', date: '2026-06-07', firstMatchTime: '17:00', matchIds: ['f1'] };
    const out = generateSchedule([day, d2], params);
    expect(out.length).toBe(4);
    expect(out[3]!).toMatchObject({ matchId: 'f1', time: '17:00', dayId: 'd2' });
  });
});

describe('shiftDaySchedule (kašnjenje uživo)', () => {
  it('pomiče odabranu i sve kasnije utakmice', () => {
    const out = shiftDaySchedule(day, params, 'm2', 10);
    expect(out.map((s) => s.matchId)).toEqual(['m2', 'm3']);
    expect(out.map((s) => s.newTime)).toEqual(['10:30', '10:50']);
  });

  it('nepoznata utakmica ili pomak 0 → prazno', () => {
    expect(shiftDaySchedule(day, params, 'nema', 10)).toEqual([]);
    expect(shiftDaySchedule(day, params, 'm1', 0)).toEqual([]);
  });
});

describe('dayDurationMinutes', () => {
  it('n utakmica + (n-1) razmaka', () => {
    expect(dayDurationMinutes(day, params)).toBe(3 * 15 + 2 * 5);
    expect(dayDurationMinutes({ ...day, matchIds: [] }, params)).toBe(0);
  });
});
