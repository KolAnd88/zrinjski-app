import { useMemo, useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { monthName, weekdayHeaders, formatDayLabel } from '../../i18n/dateLabels';
import { Button } from '../../components/ui';
import './DatePickerModal.css';

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function isoOf(y: number, m0: number, d: number) {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}
/** Broj dana u mjesecu (m0 0-baziran). */
function daysInMonth(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}
/** Indeks prvog dana mjeseca, ponedjeljak = 0. */
function firstWeekdayMonday(y: number, m0: number) {
  return (new Date(Date.UTC(y, m0, 1)).getUTCDay() + 6) % 7;
}

export function DatePickerModal({
  initialIso,
  existingDates,
  onClose,
  onConfirm,
}: {
  initialIso?: string;
  existingDates: string[];
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const { t, locale } = useT();
  const start = initialIso ? new Date(`${initialIso}T00:00:00Z`) : new Date();
  const [year, setYear] = useState(start.getUTCFullYear());
  const [month0, setMonth0] = useState(start.getUTCMonth());
  const [selected, setSelected] = useState<string | null>(initialIso ?? null);

  const cells = useMemo(() => {
    const lead = firstWeekdayMonday(year, month0);
    const total = daysInMonth(year, month0);
    const arr: (number | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [year, month0]);

  function prevMonth() {
    if (month0 === 0) {
      setMonth0(11);
      setYear((y) => y - 1);
    } else setMonth0((m) => m - 1);
  }
  function nextMonth() {
    if (month0 === 11) {
      setMonth0(0);
      setYear((y) => y + 1);
    } else setMonth0((m) => m + 1);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">{t('cal.title')}</h2>
          <button className="modal__close" aria-label="×" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cal__nav">
          <button className="cal__arrow" onClick={prevMonth} aria-label="‹">
            ‹
          </button>
          <div className="cal__month">
            {monthName(month0, locale)} {year}.
          </div>
          <button className="cal__arrow" onClick={nextMonth} aria-label="›">
            ›
          </button>
        </div>

        <div className="cal__grid cal__grid--head">
          {weekdayHeaders(locale).map((w) => (
            <div key={w} className="cal__wd">
              {w}
            </div>
          ))}
        </div>

        <div className="cal__grid">
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const iso = isoOf(year, month0, d);
            const taken = existingDates.includes(iso);
            const isSel = selected === iso;
            return (
              <button
                key={iso}
                className={`cal__day ${isSel ? 'is-selected' : ''} ${taken ? 'is-taken' : ''}`}
                disabled={taken}
                title={taken ? t('cal.taken') : undefined}
                onClick={() => setSelected(iso)}
              >
                {d}
                {taken && <span className="cal__dot" />}
              </button>
            );
          })}
        </div>

        <div className="cal__selected">
          {selected ? `${t('cal.selected')}: ${formatDayLabel(selected, locale)}` : t('cal.pick')}
        </div>

        <Button
          variant="primary"
          block
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
        >
          {t('cal.add')}
        </Button>
      </div>
    </div>
  );
}
