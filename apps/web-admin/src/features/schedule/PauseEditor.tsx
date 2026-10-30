import { useState } from 'react';
import type { Day, Match, ProgramItem } from '@zrinjski/core';
import { addMinutesToTime, timeToMinutes } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { formatDayLabel } from '../../i18n/dateLabels';
import { Button } from '../../components/ui';
import { createProgramItem, deleteProgramItem, updateProgramItem } from '../../lib/data';
import { isoToLocalHHMM, toInputTime } from '../../lib/timeFormat';
import './PauseEditor.css';

/**
 * Pauze u dvorani: otvaranje turnira, ručak.
 *
 * Pauza je stavka programa s trajanjem koja blokira teren: gledatelji je vide
 * u rasporedu među utakmicama, generiranje satnice je preskače, a ručni
 * termin u nju ne može ući. Obična stavka programa (večera u hotelu) ostaje
 * kakva jest i ne blokira ništa.
 *
 * Postojeća stavka programa može se pretvoriti u pauzu — inače bi "Svečano
 * otvaranje" u rasporedu stajalo dvaput, jednom kao program, jednom kao pauza.
 */
export function PauseEditor({
  tournamentId,
  days,
  program,
  matches,
  matchDurationMin,
  onChanged,
}: {
  tournamentId: string;
  days: Day[];
  /** Cijeli program turnira — pauze i obične stavke. */
  program: ProgramItem[];
  matches: Match[];
  matchDurationMin: number;
  onChanged: () => Promise<void>;
}) {
  const { t, locale } = useT();
  const matchDays = days.filter((d) => !!d.first_match_time);
  const [title, setTitle] = useState('');
  const [dayId, setDayId] = useState(matchDays[0]?.id ?? days[0]?.id ?? '');
  const [start, setStart] = useState('12:00');
  const [duration, setDuration] = useState('30');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dur = Math.max(1, Math.min(600, parseInt(duration, 10) || 0));
  const dayOf = (id: string) => days.find((d) => d.id === id);
  const dayLabel = (id: string) => {
    const d = dayOf(id);
    return d ? formatDayLabel(d.date, locale) : '';
  };
  const byTime = (a: ProgramItem, b: ProgramItem) =>
    (dayOf(a.day_id)?.date ?? '').localeCompare(dayOf(b.day_id)?.date ?? '') || a.time.localeCompare(b.time);

  const pauses = program.filter((p) => p.is_pause).sort(byTime);
  // Kandidati za pretvaranje: obične stavke na danima kad se igra.
  const convertible = program
    .filter((p) => !p.is_pause && matchDays.some((d) => d.id === p.day_id))
    .sort(byTime);

  /** Utakmice koje zahvaćaju pauzu — treba ih pomaknuti ili ponovno generirati. */
  const overlapping = (p: ProgramItem) => {
    const ps = timeToMinutes(toInputTime(p.time));
    const pe = ps + (p.duration_min ?? 0);
    return matches.filter((m) => {
      if (m.day_id !== p.day_id || !m.scheduled_time) return false;
      const s = timeToMinutes(isoToLocalHHMM(m.scheduled_time));
      return s < pe && s + matchDurationMin > ps;
    });
  };

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await action();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const add = () =>
    run(async () => {
      await createProgramItem({
        tournament_id: tournamentId,
        day_id: dayId,
        time: start,
        title: title.trim(),
        is_pause: true,
        duration_min: dur,
      });
      setTitle('');
    });

  const convert = (p: ProgramItem) => run(() => updateProgramItem(p.id, { is_pause: true, duration_min: dur }));
  const unset = (p: ProgramItem) => run(() => updateProgramItem(p.id, { is_pause: false, duration_min: null }));
  const remove = (p: ProgramItem) => {
    if (!window.confirm(t('pause.removeConfirm', { title: p.title }))) return;
    void run(() => deleteProgramItem(p.id));
  };

  return (
    <div className="pause">
      <h2 className="section-label">{t('pause.title')}</h2>
      <p className="ko__hint">{t('pause.hint')}</p>

      {pauses.length === 0 ? (
        <p className="ko__none">{t('pause.none')}</p>
      ) : (
        <ul className="pause__list">
          {pauses.map((p) => {
            const s = toInputTime(p.time);
            const clash = overlapping(p);
            return (
              <li key={p.id} className="pause__item">
                <div className="pause__row">
                  <span className="pause__when">
                    {dayLabel(p.day_id)} · {s}–{addMinutesToTime(s, p.duration_min ?? 0)}
                  </span>
                  <span className="pause__name">{p.title}</span>
                </div>
                {clash.length > 0 && (
                  <p className="pause__warn">
                    {t('pause.overlap', { time: clash.map((m) => isoToLocalHHMM(m.scheduled_time)).join(', ') })}
                  </p>
                )}
                <div className="pause__actions">
                  <Button variant="ghost" disabled={busy} onClick={() => void unset(p)}>
                    {t('pause.unset')}
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => remove(p)}>
                    {t('pause.remove')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pause__form">
        <label className="mtime__field pause__title">
          <span className="field-label">{t('pause.name')}</span>
          <input
            className="input"
            value={title}
            placeholder={t('pause.namePh')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mtime__field">
          <span className="field-label">{t('pause.day')}</span>
          <select className="input" value={dayId} onChange={(e) => setDayId(e.target.value)}>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDayLabel(d.date, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="mtime__field">
          <span className="field-label">{t('pause.start')}</span>
          <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="mtime__field">
          <span className="field-label">{t('pause.duration')}</span>
          <div className="input-wrap">
            <input
              className="input numfield__input"
              type="number"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <span className="input-affix">{t('tournament.min')}</span>
          </div>
        </label>
      </div>
      <div className="savebar">
        <Button
          variant="primary"
          disabled={busy || !title.trim() || !dayId || !/^\d{2}:\d{2}$/.test(start)}
          onClick={() => void add()}
        >
          {t('pause.add')}
        </Button>
        {err && <span className="savebar__err">{err}</span>}
      </div>

      {convertible.length > 0 && (
        <>
          <p className="ko__hint pause__convhint">{t('pause.convertHint', { n: dur })}</p>
          <ul className="pause__list">
            {convertible.map((p) => (
              <li key={p.id} className="pause__item pause__item--conv">
                <div className="pause__row">
                  <span className="pause__when">
                    {dayLabel(p.day_id)} · {toInputTime(p.time)}
                  </span>
                  <span className="pause__name">{p.title}</span>
                </div>
                <div className="pause__actions">
                  <Button variant="ghost" disabled={busy} onClick={() => void convert(p)}>
                    {t('pause.convert')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
