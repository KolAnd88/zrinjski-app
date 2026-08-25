import { useEffect, useState } from 'react';
import type { Tournament as TournamentRow } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Card } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { DaysEditor } from '../features/tournament/DaysEditor';
import { ProgramEditor } from '../features/tournament/ProgramEditor';
import { ContactsEditor } from '../features/tournament/ContactsEditor';
import './Tournament.css';

type NumKey =
  | 'match_duration_min'
  | 'gap_min'
  | 'points_win'
  | 'points_draw'
  | 'points_loss'
  | 'advance_per_group';

function NumberField({
  label,
  suffix,
  value,
  min = 0,
  onSave,
}: {
  label: string;
  suffix?: string;
  value: number;
  min?: number;
  onSave: (v: number) => Promise<void>;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);

  async function commit() {
    const n = Number(local);
    if (Number.isFinite(n) && n >= min && n !== value) await onSave(n);
    else setLocal(String(value));
  }

  return (
    <div className="numfield">
      <label className="field-label">{label}</label>
      <div className="input-wrap">
        <input
          className="input numfield__input"
          type="number"
          min={min}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => void commit()}
        />
        {suffix && <span className="input-affix">{suffix}</span>}
      </div>
    </div>
  );
}

export function Tournament() {
  const { t } = useT();
  const data = useTournamentData();
  const [savedFlash, setSavedFlash] = useState(false);

  if (!data.configured) {
    return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  }
  if (data.loading) {
    return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  }
  if (data.error) {
    return <Card accent style={{ maxWidth: 560 }}>{data.error}</Card>;
  }
  if (!data.tournament) {
    return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  }

  const tr: TournamentRow = data.tournament;

  const save = (key: NumKey) => async (v: number) => {
    await data.saveSettings({ [key]: v });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  return (
    <div className="tournament">
      {savedFlash && <div className="banner banner--ok">{t('tournament.saved')}</div>}

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('tournament.durationGap')}
        </h2>
        <div className="grid-2">
          <NumberField
            label={t('tournament.duration')}
            suffix={t('tournament.min')}
            value={tr.match_duration_min}
            min={1}
            onSave={save('match_duration_min')}
          />
          <NumberField
            label={t('tournament.gap')}
            suffix={t('tournament.min')}
            value={tr.gap_min}
            min={0}
            onSave={save('gap_min')}
          />
        </div>
      </Card>

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('tournament.scoring')}
        </h2>
        <div className="grid-4">
          <NumberField label={t('tournament.win')} value={tr.points_win} onSave={save('points_win')} />
          <NumberField label={t('tournament.draw')} value={tr.points_draw} onSave={save('points_draw')} />
          <NumberField label={t('tournament.loss')} value={tr.points_loss} onSave={save('points_loss')} />
          <NumberField
            label={t('tournament.advance')}
            value={tr.advance_per_group}
            min={1}
            onSave={save('advance_per_group')}
          />
        </div>
      </Card>

      <Card>
        <DaysEditor days={data.days} onAdd={data.addDay} onEdit={data.editDay} onRemove={data.removeDay} />
      </Card>

      <Card>
        <ProgramEditor tournamentId={tr.id} days={data.days} />
      </Card>

      <Card>
        <ContactsEditor tournamentId={tr.id} />
      </Card>
    </div>
  );
}
