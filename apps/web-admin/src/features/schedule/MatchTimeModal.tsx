import { useEffect, useMemo, useState } from 'react';
import type { Day, Match, ProgramItem } from '@zrinjski/core';
import { combineDateTime, shiftFollowing, slotConflicts, timeToMinutes, type SlotConflict } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { formatDayLabel } from '../../i18n/dateLabels';
import { Button } from '../../components/ui';
import { isoToLocalHHMM, toInputTime } from '../../lib/timeFormat';
import type { TeamLite } from './useScheduleMatches';
import './MatchTimeModal.css';

type Change = { id: string; day_id: string | null; scheduled_time: string | null };

/**
 * Ručni termin utakmice: dan i sat, po želji "Pomakni i sve iza".
 *
 * Igra se na jednom terenu, pa se prije spremanja pokaže svaki sudar — s
 * drugom utakmicom (bliže od trajanja + razmaka) ili s pauzom. Spremanje je
 * isključeno dok sudara ima. Isto pravilo provjerava i baza, za slučaj da dva
 * organizatora mijenjaju satnicu istodobno.
 */
export function MatchTimeModal({
  m,
  matches,
  days,
  pauses,
  params,
  teamsById,
  onClose,
  onSave,
}: {
  m: Match;
  matches: Match[];
  days: Day[];
  pauses: ProgramItem[];
  params: { matchDurationMin: number; gapMin: number };
  teamsById: Map<string, TeamLite>;
  onClose: () => void;
  onSave: (changes: Change[]) => Promise<void>;
}) {
  const { t, locale } = useT();
  const [dayId, setDayId] = useState(m.day_id ?? days[0]?.id ?? '');
  const [time, setTime] = useState(
    isoToLocalHHMM(m.scheduled_time) || toInputTime(days.find((d) => d.id === m.day_id)?.first_match_time) || '10:00'
  );
  const [chain, setChain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const day = days.find((d) => d.id === dayId);
  const sameDay = dayId === m.day_id;
  const canChain = sameDay && !!m.scheduled_time;
  const valid = /^\d{2}:\d{2}$/.test(time);

  const nameOf = (x: Match) => {
    const h = x.home_team_id ? teamsById.get(x.home_team_id)?.name : null;
    const a = x.away_team_id ? teamsById.get(x.away_team_id)?.name : null;
    return `${h ?? x.home_placeholder ?? '?'} – ${a ?? x.away_placeholder ?? '?'}`;
  };

  /** Utakmice odabranog dana s terminom, kronološki ("HH:MM"). */
  const dayRows = useMemo(
    () =>
      matches
        .filter((x) => x.day_id === dayId && x.scheduled_time && (sameDay || x.id !== m.id))
        .map((x) => ({ id: x.id, start: isoToLocalHHMM(x.scheduled_time), movable: x.status === 'scheduled' }))
        .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)),
    [matches, dayId, sameDay, m.id]
  );
  const dayPauses = useMemo(
    () =>
      pauses
        .filter((p) => p.day_id === dayId)
        .map((p) => ({ start: toInputTime(p.time), durationMin: p.duration_min ?? 0, title: p.title })),
    [pauses, dayId]
  );

  /** Što se mijenja: sama utakmica, ili ona i sve iza nje. */
  const plan = useMemo(() => {
    if (!valid) return null;
    if (chain && canChain) {
      return shiftFollowing({ day: dayRows, matchId: m.id, newStart: time, pauses: dayPauses, params });
    }
    return [{ id: m.id, start: time }];
  }, [valid, chain, canChain, dayRows, m.id, time, dayPauses, params]);

  /** Sudari u konačnom rasporedu dana, svaki par jednom. */
  const conflicts = useMemo(() => {
    if (!plan) return [];
    const finalPos = new Map(dayRows.map((r) => [r.id, r.start] as const));
    for (const c of plan) finalPos.set(c.id, c.start);
    const others = [...finalPos].map(([id, start]) => ({ id, start }));
    const seen = new Set<string>();
    const out: (SlotConflict & { forId: string })[] = [];
    for (const c of plan) {
      for (const x of slotConflicts({ matchId: c.id, start: c.start, others, pauses: dayPauses, params })) {
        const key = x.kind === 'too_close' ? [c.id, x.otherId].sort().join('|') : `${c.id}|${x.title}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...x, forId: c.id });
      }
    }
    return out;
  }, [plan, dayRows, dayPauses, params]);

  const unchanged = sameDay && plan?.length === 1 && plan[0]!.start === isoToLocalHHMM(m.scheduled_time);
  const byId = new Map(matches.map((x) => [x.id, x] as const));

  async function save() {
    if (!plan || !day || conflicts.length > 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(
        plan.map((c) => ({ id: c.id, day_id: day.id, scheduled_time: combineDateTime(day.date, c.start) }))
      );
      onClose();
    } catch (e) {
      const s = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
      setErr(
        s.includes('too_close')
          ? t('tm.errClose')
          : s.includes('in_pause')
            ? t('tm.errPause')
            : s.includes('match_locked')
              ? t('tm.errLocked')
              : s.includes('wrong_day')
                ? t('tm.errDay')
                : s
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal mtime" role="dialog" aria-modal="true" aria-labelledby="mtime-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title" id="mtime-title">
            {t('tm.title')}
          </h2>
          <button className="modal__close" aria-label="×" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="mtime__match">{nameOf(m)}</p>

        <div className="mtime__grid">
          <label className="mtime__field">
            <span className="field-label">{t('tm.day')}</span>
            <select
              className="input"
              value={dayId}
              onChange={(e) => {
                setDayId(e.target.value);
                setChain(false);
              }}
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDayLabel(d.date, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="mtime__field">
            <span className="field-label">{t('tm.time')}</span>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <label className={`fin__check ${canChain ? '' : 'is-off'}`}>
          <input type="checkbox" checked={chain && canChain} disabled={!canChain} onChange={(e) => setChain(e.target.checked)} />
          {t('tm.chain')}
        </label>
        <p className="ko__hint">{t('tm.chainHint')}</p>

        {chain && canChain && plan && plan.length > 0 && (
          <div className="mtime__moves">
            <span className="field-label">{t('tm.moves')}</span>
            <ul>
              {plan.map((c) => {
                const x = byId.get(c.id);
                return (
                  <li key={c.id}>
                    <span className="mtime__from">{isoToLocalHHMM(x?.scheduled_time)}</span> →{' '}
                    <strong>{c.start}</strong> · {x ? nameOf(x) : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {plan === null && valid && <p className="savebar__err">{t('tm.overflow')}</p>}

        {conflicts.length > 0 && (
          <ul className="mtime__conflicts">
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.kind === 'too_close'
                  ? t('tm.tooClose', {
                      time: c.otherTime,
                      match: byId.get(c.otherId) ? nameOf(byId.get(c.otherId)!) : '',
                      min: c.minGap,
                    })
                  : t('tm.inPause', { title: c.title, start: c.start, end: c.end })}
              </li>
            ))}
          </ul>
        )}

        <div className="savebar">
          <Button
            variant="primary"
            disabled={!plan || !day || conflicts.length > 0 || busy || unchanged}
            onClick={() => void save()}
          >
            {busy ? t('form.saving') : t('tm.save')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('form.cancel')}
          </Button>
          {err && <span className="savebar__err">{err}</span>}
        </div>
      </div>
    </div>
  );
}
