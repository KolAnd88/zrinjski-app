import { clockMinute, clockRunning, formatClock, timeoutLeft, type Match } from '@zrinjski/core';
import type { StringKey } from '../i18n/strings';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

/**
 * Što gledatelj vidi umjesto minute utakmice uživo.
 *
 *   teče      → "7'"
 *   stoji     → "SAT STOJI · 7'"
 *   time-out  → "TIME-OUT · ZRINJSKI · 0:34"
 *
 * Bez ovoga bi se zaustavljen sat gledatelju činio kao zaglavljena aplikacija.
 */
export function clockLabel(m: Match, now: number, t: T, teamName: (id: string) => string | undefined): string {
  const left = timeoutLeft(m, now);
  if (left !== null) {
    const who = (m.timeout_team_id && teamName(m.timeout_team_id)) || '';
    return t('live.timeoutLabel', { team: who.toUpperCase(), left: formatClock(left) });
  }
  const minute = `${clockMinute(m, now)}'`;
  return clockRunning(m) ? minute : `${t('live.clockStopped')} · ${minute}`;
}
