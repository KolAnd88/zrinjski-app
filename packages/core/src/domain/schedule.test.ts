import { describe, expect, it } from 'vitest';
import {
  dayDurationMinutes,
  generateDaySchedule,
  generateSchedule,
  shiftDaySchedule,
  shiftFollowing,
  slotConflicts,
  type DayInput,
} from './schedule';

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

describe('pauze', () => {
  it('generiranje preskače pauzu: utakmica kreće kad pauza završi', () => {
    const d: DayInput = { ...day, matchIds: ['m1', 'm2', 'm3', 'm4'], pauses: [{ start: '10:45', durationMin: 30 }] };
    // 10:00, 10:20, 10:40 bi zahvatila pauzu 10:45–11:15 → 11:15, pa 11:35
    expect(generateDaySchedule(d, params).map((s) => s.time)).toEqual(['10:00', '10:20', '11:15', '11:35']);
  });

  it('studeni: termin se sprema s +01:00', () => {
    const out = generateDaySchedule({ ...day, date: '2026-11-06' }, params);
    expect(out[0]!.scheduledTime).toBe('2026-11-06T10:00:00+01:00');
  });
});

describe('slotConflicts (jedan teren)', () => {
  const others = [
    { id: 'a', start: '10:00' },
    { id: 'b', start: '10:20' },
  ];
  const pauses = [{ start: '12:00', durationMin: 45, title: 'Otvaranje turnira' }];

  it('bliže od trajanja + razmaka se ne smije', () => {
    expect(slotConflicts({ matchId: 'x', start: '10:30', others, pauses, params })).toEqual([
      { kind: 'too_close', otherId: 'b', otherTime: '10:20', minGap: 20 },
    ]);
  });

  it('točno na razmaku smije', () => {
    expect(slotConflicts({ matchId: 'x', start: '10:40', others, pauses, params })).toEqual([]);
  });

  it('utakmica ne smije zahvatiti pauzu', () => {
    expect(slotConflicts({ matchId: 'x', start: '11:50', others, pauses, params })).toEqual([
      { kind: 'in_pause', title: 'Otvaranje turnira', start: '12:00', end: '12:45' },
    ]);
    expect(slotConflicts({ matchId: 'x', start: '12:45', others, pauses, params })).toEqual([]);
  });

  it('vlastiti stari termin se ne računa', () => {
    expect(slotConflicts({ matchId: 'b', start: '10:25', others: [{ id: 'b', start: '10:20' }], pauses: [], params })).toEqual([]);
  });
});

describe('shiftFollowing (pomakni i sve iza)', () => {
  const dan = [
    { id: 'a', start: '10:00', movable: true },
    { id: 'b', start: '10:20', movable: true },
    { id: 'c', start: '10:40', movable: true },
    { id: 'd', start: '13:00', movable: true },
  ];

  it('sve iza se pomakne za isto', () => {
    expect(shiftFollowing({ day: dan, matchId: 'b', newStart: '10:30', pauses: [], params })).toEqual([
      { id: 'b', start: '10:30' },
      { id: 'c', start: '10:50' },
      { id: 'd', start: '13:10' },
    ]);
  });

  it('preko pauze: utakmica koja bi ušla u pauzu ide iza nje', () => {
    const out = shiftFollowing({ day: dan, matchId: 'b', newStart: '11:00', pauses: [{ start: '11:30', durationMin: 30 }], params });
    expect(out).toEqual([
      { id: 'b', start: '11:00' },
      { id: 'c', start: '12:00' },
      { id: 'd', start: '13:40' },
    ]);
  });

  it('odigrana utakmica prekida lanac', () => {
    const d2 = dan.map((m) => (m.id === 'c' ? { ...m, movable: false } : m));
    expect(shiftFollowing({ day: d2, matchId: 'b', newStart: '10:25', pauses: [], params })).toEqual([{ id: 'b', start: '10:25' }]);
  });
});
