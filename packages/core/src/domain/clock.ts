// clock.ts — sat utakmice: pauza, nastavak i time-out.
//
// Baza ne pamti "koliko je sati na satu", nego STANJE sata (migracija 0037):
//
//   vrijeme = clock_base_sec + (clock_running ? sada − clock_started_at : 0)
//
// Tako svaki uređaj — zapisničarev laptop, mobilni admin, TV, gledatelj — sam
// izračuna isto vrijeme bez ijednog upisa u sekundi. Upis ide samo kad se sat
// pokrene ili zaustavi.
//
// Promjene stanja vraćaju se kao "zakrpe" (patch) za tablicu `match`, pa ih
// web admin šalje izravno, a mobilni admin kroz red čekanja (radi bez mreže).
// Vrijeme zakrpe je sat uređaja koji je upisuje — za razliku od poslužiteljskog
// vremena, radi i bez mreže, a razlika od par sekundi se ne vidi.
import type { Match } from '../types/database';

/** Time-out traje točno jednu minutu. */
export const TIMEOUT_SEC = 60;

export type ClockState = Pick<
  Match,
  | 'status'
  | 'current_minute'
  | 'clock_running'
  | 'clock_base_sec'
  | 'clock_started_at'
  | 'timeout_team_id'
  | 'timeout_started_at'
  | 'home_team_id'
  | 'away_team_id'
  | 'home_timeouts'
  | 'away_timeouts'
>;

export type ClockPatch = Partial<
  Pick<
    Match,
    | 'status'
    | 'current_half'
    | 'current_minute'
    | 'clock_running'
    | 'clock_base_sec'
    | 'clock_started_at'
    | 'timeout_team_id'
    | 'timeout_started_at'
    | 'home_timeouts'
    | 'away_timeouts'
  >
>;

/** Zadano stanje sata (isto kao zadane vrijednosti stupaca u bazi). */
export const MATCH_CLOCK_DEFAULTS = {
  clock_running: false,
  clock_base_sec: 0,
  clock_started_at: null,
  timeout_team_id: null,
  timeout_started_at: null,
  home_timeouts: 0,
  away_timeouts: 0,
} as const satisfies Partial<Match>;

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/**
 * Utakmicu je pokrenula starija verzija aplikacije (1.2.0), koja ne zna za
 * stanje sata: piše samo current_minute. Tada je jedina istina ta minuta.
 */
function isLegacy(m: ClockState): boolean {
  return !m.clock_running && !m.clock_started_at && (m.clock_base_sec ?? 0) === 0 && (m.current_minute ?? 0) > 0;
}

/** Odigrane sekunde u trenutku `now` (ms). */
export function clockSeconds(m: ClockState, now: number): number {
  if (isLegacy(m)) return (m.current_minute ?? 0) * 60;
  const base = Math.max(0, m.clock_base_sec ?? 0);
  if (m.status !== 'live' || !m.clock_running) return base;
  const started = ms(m.clock_started_at);
  if (started === null) return base;
  // Sat uređaja zna biti koju sekundu iza zapisničareva — ne smije ići unatrag.
  return base + Math.max(0, Math.floor((now - started) / 1000));
}

/** Minuta za događaje i prikaz ("7'"). */
export function clockMinute(m: ClockState, now: number): number {
  return Math.floor(clockSeconds(m, now) / 60);
}

/** "07:42" */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Teče li sat (utakmica uživo i nije zaustavljena). */
export function clockRunning(m: ClockState): boolean {
  if (m.status !== 'live') return false;
  // Stara aplikacija nije znala zaustaviti sat — njezina utakmica uvijek teče.
  return m.clock_running || isLegacy(m);
}

/** Preostale sekunde tekućeg time-outa; null kad time-outa nema. */
export function timeoutLeft(m: ClockState, now: number): number | null {
  if (m.status !== 'live' || !m.timeout_team_id) return null;
  const started = ms(m.timeout_started_at);
  if (started === null) return null;
  return Math.max(0, TIMEOUT_SEC - Math.floor((now - started) / 1000));
}

/** Koliko je time-outa ekipa iskoristila. */
export function timeoutsUsed(m: ClockState, teamId: string): number {
  if (teamId === m.home_team_id) return m.home_timeouts ?? 0;
  if (teamId === m.away_team_id) return m.away_timeouts ?? 0;
  return 0;
}

const iso = (now: number) => new Date(now).toISOString();

/** Početak utakmice: sat kreće od nule, brojači time-outa se brišu. */
export function clockStartPatch(now: number): ClockPatch {
  return {
    status: 'live',
    current_half: 1,
    current_minute: 0,
    clock_running: true,
    clock_base_sec: 0,
    clock_started_at: iso(now),
    timeout_team_id: null,
    timeout_started_at: null,
    home_timeouts: 0,
    away_timeouts: 0,
  };
}

/** Zaustavi sat; odigrane sekunde prelaze u bazu. */
export function clockPausePatch(m: ClockState, now: number): ClockPatch {
  const sec = clockSeconds(m, now);
  return {
    clock_running: false,
    clock_base_sec: sec,
    clock_started_at: null,
    current_minute: Math.floor(sec / 60),
  };
}

/** Nastavi sat; završava i time-out ako je trajao. */
export function clockResumePatch(m: ClockState, now: number): ClockPatch {
  return {
    // Iz stare utakmice preuzima se njezina minuta, inače bi sat skočio na nulu.
    clock_base_sec: clockSeconds(m, now),
    clock_running: true,
    clock_started_at: iso(now),
    timeout_team_id: null,
    timeout_started_at: null,
  };
}

/**
 * Time-out ekipe: sat staje, kreće odbrojavanje od minute.
 *
 * Sat se NE nastavlja sam kad minuta istekne — igra se nastavlja na sučev
 * zvižduk, pa zapisničar sam klikne "Nastavi". Broj time-outa se ne
 * ograničava (odluka organizatora); samo se broji.
 */
export function timeoutPatch(m: ClockState, teamId: string, now: number): ClockPatch {
  const home = teamId === m.home_team_id;
  return {
    ...clockPausePatch(m, now),
    timeout_team_id: teamId,
    timeout_started_at: iso(now),
    ...(home ? { home_timeouts: (m.home_timeouts ?? 0) + 1 } : { away_timeouts: (m.away_timeouts ?? 0) + 1 }),
  };
}

/** Kraj utakmice: sat se zamrzne na odigranom vremenu. */
export function clockFinishPatch(m: ClockState, now: number): ClockPatch {
  return {
    ...(m.status === 'live' ? clockPausePatch(m, now) : {}),
    status: 'finished',
    timeout_team_id: null,
    timeout_started_at: null,
  };
}
