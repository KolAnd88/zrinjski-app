import { describe, expect, it } from 'vitest';
import {
  clockFinishPatch,
  clockMinute,
  clockPausePatch,
  clockResumePatch,
  clockRunning,
  clockSeconds,
  clockStartPatch,
  formatClock,
  timeoutLeft,
  timeoutPatch,
  timeoutsUsed,
  type ClockState,
} from './clock';

const T0 = Date.parse('2026-11-06T12:30:00Z');
const sec = (n: number) => T0 + n * 1000;

const idle: ClockState = {
  status: 'scheduled',
  current_minute: null,
  clock_running: false,
  clock_base_sec: 0,
  clock_started_at: null,
  timeout_team_id: null,
  timeout_started_at: null,
  home_team_id: 'h',
  away_team_id: 'a',
  home_timeouts: 0,
  away_timeouts: 0,
};

const apply = (m: ClockState, p: object): ClockState => ({ ...m, ...p }) as ClockState;

describe('sat utakmice', () => {
  it('prije početka stoji na nuli', () => {
    expect(clockSeconds(idle, sec(500))).toBe(0);
    expect(clockRunning(idle)).toBe(false);
  });

  it('nakon početka broji od nule', () => {
    const m = apply(idle, clockStartPatch(T0));
    expect(clockRunning(m)).toBe(true);
    expect(clockSeconds(m, sec(95))).toBe(95);
    expect(clockMinute(m, sec(95))).toBe(1);
    expect(formatClock(clockSeconds(m, sec(95)))).toBe('01:35');
  });

  it('pauza zamrzne vrijeme, nastavak broji dalje od istog mjesta', () => {
    let m = apply(idle, clockStartPatch(T0));
    m = apply(m, clockPausePatch(m, sec(300)));
    expect(clockRunning(m)).toBe(false);
    expect(clockSeconds(m, sec(900))).toBe(300);
    expect(m.current_minute).toBe(5);

    m = apply(m, clockResumePatch(m, sec(900)));
    expect(clockSeconds(m, sec(960))).toBe(360);
  });

  it('time-out zaustavi sat, odbrojava minutu i broji se po ekipi', () => {
    let m = apply(idle, clockStartPatch(T0));
    m = apply(m, timeoutPatch(m, 'a', sec(400)));
    expect(clockRunning(m)).toBe(false);
    expect(clockSeconds(m, sec(430))).toBe(400);
    expect(timeoutLeft(m, sec(430))).toBe(30);
    expect(timeoutLeft(m, sec(500))).toBe(0);
    expect(timeoutsUsed(m, 'a')).toBe(1);
    expect(timeoutsUsed(m, 'h')).toBe(0);

    // Sat se ne nastavlja sam — tek na "Nastavi", i time-out tada nestaje.
    m = apply(m, clockResumePatch(m, sec(470)));
    expect(timeoutLeft(m, sec(471))).toBeNull();
    expect(clockSeconds(m, sec(480))).toBe(410);

    // Broj time-outa nije ograničen.
    m = apply(m, timeoutPatch(m, 'a', sec(600)));
    expect(timeoutsUsed(m, 'a')).toBe(2);
  });

  it('kraj utakmice zamrzne sat i briše time-out', () => {
    let m = apply(idle, clockStartPatch(T0));
    m = apply(m, timeoutPatch(m, 'h', sec(700)));
    m = apply(m, clockFinishPatch(m, sec(720)));
    expect(m.status).toBe('finished');
    expect(clockSeconds(m, sec(5000))).toBe(700);
    expect(timeoutLeft(m, sec(721))).toBeNull();
  });

  it('utakmica pokrenuta starom aplikacijom (samo current_minute) prikazuje tu minutu', () => {
    const legacy: ClockState = { ...idle, status: 'live', current_minute: 9 };
    expect(clockSeconds(legacy, sec(10))).toBe(540);
    expect(clockRunning(legacy)).toBe(true);
    // Nastavak iz nove aplikacije preuzima minutu umjesto da krene od nule.
    const p = clockResumePatch(legacy, sec(10));
    expect(p.clock_base_sec).toBe(540);
  });

  it('sat uređaja iza zapisničareva ne vraća vrijeme unatrag', () => {
    const m = apply(idle, clockStartPatch(sec(100)));
    expect(clockSeconds(m, sec(98))).toBe(0);
  });
});
