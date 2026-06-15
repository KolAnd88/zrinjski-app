import { useState } from 'react';
import type { Day, TablesUpdate } from '@zrinjski/core';
import { parseIsoDate } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import { formatDayLabel } from '../../i18n/dateLabels';
import { toInputTime, fromInputTime } from '../../lib/timeFormat';
import { Button } from '../../components/ui';
import { DatePickerModal } from './DatePickerModal';
import './DaysEditor.css';

function weekdayInitial(iso: string) {
  // Prvo slovo dana (Č, P, S…) iz hrvatskog naziva.
  const map = ['N', 'P', 'U', 'S', 'Č', 'P', 'S']; // ned..sub po getUTCDay
  return map[parseIsoDate(iso).getUTCDay()] ?? '?';
}

function DayRow({
  day,
  onEdit,
  onRemove,
}: {
  day: Day;
  onEdit: (patch: TablesUpdate<'day'>) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { t, locale } = useT();
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState(toInputTime(day.first_match_time));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await onEdit({ first_match_time: fromInputTime(time) });
    setBusy(false);
    setEditing(false);
  }

  return (
    <div className="day-row">
      <div className="day-row__badge">{weekdayInitial(day.date)}</div>
      <div className="day-row__main">
        <div className="day-row__title">{formatDayLabel(day.date, locale)}</div>
        {editing ? (
          <div className="day-row__edit">
            <input
              className="input day-row__time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
            <Button variant="primary" onClick={() => void save()} disabled={busy}>
              {t('tournament.save')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              {t('tournament.cancel')}
            </Button>
          </div>
        ) : (
          <div className="day-row__sub">
            {t('tournament.firstMatch')}:{' '}
            {day.first_match_time ? toInputTime(day.first_match_time) : t('tournament.socialOnly')}
          </div>
        )}
      </div>
      {!editing && (
        <div className="day-row__actions">
          <button className="btn-link" onClick={() => setEditing(true)}>
            {t('tournament.edit')}
          </button>
          <button
            className="day-row__del"
            aria-label="×"
            onClick={() => {
              if (confirm(t('tournament.deleteDayConfirm'))) void onRemove();
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export function DaysEditor({
  days,
  onAdd,
  onEdit,
  onRemove,
}: {
  days: Day[];
  onAdd: (iso: string) => Promise<void>;
  onEdit: (id: string, patch: TablesUpdate<'day'>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const { t } = useT();
  const [picking, setPicking] = useState(false);

  return (
    <div className="days">
      <div className="days__head">
        <h2 className="section-label">{t('tournament.days')}</h2>
        <span className="days__hint">{t('tournament.startPerDay')}</span>
      </div>

      {days.length === 0 ? (
        <div className="days__empty">{t('tournament.noDays')}</div>
      ) : (
        <div className="days__list">
          {days.map((d) => (
            <DayRow
              key={d.id}
              day={d}
              onEdit={(patch) => onEdit(d.id, patch)}
              onRemove={() => onRemove(d.id)}
            />
          ))}
        </div>
      )}

      <button className="days__add" onClick={() => setPicking(true)}>
        {t('tournament.addDay')}
      </button>

      {picking && (
        <DatePickerModal
          existingDates={days.map((d) => d.date)}
          onClose={() => setPicking(false)}
          onConfirm={async (iso) => {
            await onAdd(iso);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
