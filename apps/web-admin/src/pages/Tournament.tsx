import { useCallback, useEffect, useState } from 'react';
import type { Tournament as TournamentRow } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Card, SaveBar } from '../components/ui';
import { useDraft } from '../components/useDraft';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { DaysEditor } from '../features/tournament/DaysEditor';
import { ProgramEditor } from '../features/tournament/ProgramEditor';
import { ContactsEditor } from '../features/tournament/ContactsEditor';
import './Tournament.css';

/** Polja koja stranica drži u nacrtu i šalje tek na "Spremi". */
type SettingsDraft = {
  name: string;
  match_duration_min: number;
  gap_min: number;
  points_win: number;
  points_draw: number;
  points_loss: number;
  advance_per_group: number;
  rules: string;
  format: string;
  about_club: string;
};

function NumberField({
  label,
  suffix,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  // Tekst se drži zasebno da se polje smije nakratko isprazniti dok se tipka;
  // broj ide van tek kad je stvarno broj.
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);

  return (
    <div className="numfield">
      <label className="field-label">{label}</label>
      <div className="input-wrap">
        <input
          className="input numfield__input"
          type="number"
          min={min}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(n) && n >= min) onChange(n);
          }}
          onBlur={() => setLocal(String(value))}
        />
        {suffix && <span className="input-affix">{suffix}</span>}
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="tour__text">
      <label className="field-label">{label}</label>
      <textarea
        className="input tour__textarea"
        rows={5}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
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

  return (
    <div className="tournament">
      <SettingsForm tr={tr} onSave={data.saveSettings} />

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

/**
 * Postavke turnira — sve u jednom nacrtu, jedan "Spremi".
 *
 * Zasebna komponenta jer `useDraft` mora imati turnir; da je kuka gore u
 * `Tournament`, zvala bi se i dok podaci još nisu stigli.
 */
function SettingsForm({
  tr,
  onSave,
}: {
  tr: TournamentRow;
  onSave: (patch: Partial<TournamentRow>) => Promise<void>;
}) {
  const { t } = useT();

  const draft = useDraft<SettingsDraft>(
    {
      name: tr.name,
      match_duration_min: tr.match_duration_min,
      gap_min: tr.gap_min,
      points_win: tr.points_win,
      points_draw: tr.points_draw,
      points_loss: tr.points_loss,
      advance_per_group: tr.advance_per_group,
      rules: tr.rules ?? '',
      format: tr.format ?? '',
      about_club: tr.about_club ?? '',
    },
    useCallback(
      async (changed: Partial<SettingsDraft>) => {
        const patch: Partial<TournamentRow> = { ...changed };
        // Prazan naziv bi ostavio aplikaciju bez natpisa, a prazan tekst je
        // valjan način da se odjeljak sakrije — zato se sprema kao NULL.
        if (typeof patch.name === 'string' && !patch.name.trim()) delete patch.name;
        for (const k of ['rules', 'format', 'about_club'] as const) {
          if (typeof patch[k] === 'string' && !patch[k]!.trim()) patch[k] = null;
        }
        await onSave(patch);
      },
      [onSave]
    )
  );

  const labels = {
    save: t('form.save'),
    saving: t('form.saving'),
    cancel: t('form.cancel'),
    saved: t('form.saved'),
    unsaved: t('form.unsaved'),
  };

  // Zatvaranje kartice s nespremljenim nacrtom tiho baca rad — upozori.
  useEffect(() => {
    if (!draft.dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft.dirty]);

  return (
    <>
      {/* Naziv se pojavljuje u aplikaciji, na zapisniku i na slici rezultata
          koja ide na mreže — dosad se mogao promijeniti samo ručnim SQL-om.
          Godina se ne unosi zasebno: nosi je sam naziv ("… 2026"), a dva
          mjesta za istu informaciju prije ili kasnije se raziđu. */}
      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('tournament.identity')}
        </h2>
        <label className="field-label">{t('tournament.name')}</label>
        <input
          className="input"
          value={draft.value.name}
          placeholder={t('tournament.namePlaceholder')}
          onChange={(e) => draft.set('name', e.target.value)}
        />
        <p className="tour__hint">{t('tournament.nameHint')}</p>
      </Card>

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('tournament.durationGap')}
        </h2>
        <div className="grid-2">
          <NumberField
            label={t('tournament.duration')}
            suffix={t('tournament.min')}
            value={draft.value.match_duration_min}
            min={1}
            onChange={(v) => draft.set('match_duration_min', v)}
          />
          <NumberField
            label={t('tournament.gap')}
            suffix={t('tournament.min')}
            value={draft.value.gap_min}
            min={0}
            onChange={(v) => draft.set('gap_min', v)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('tournament.scoring')}
        </h2>
        <div className="grid-4">
          <NumberField
            label={t('tournament.win')}
            value={draft.value.points_win}
            onChange={(v) => draft.set('points_win', v)}
          />
          <NumberField
            label={t('tournament.draw')}
            value={draft.value.points_draw}
            onChange={(v) => draft.set('points_draw', v)}
          />
          <NumberField
            label={t('tournament.loss')}
            value={draft.value.points_loss}
            onChange={(v) => draft.set('points_loss', v)}
          />
          <NumberField
            label={t('tournament.advance')}
            value={draft.value.advance_per_group}
            min={1}
            onChange={(v) => draft.set('advance_per_group', v)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('texts.title')}
        </h2>
        <TextArea
          label={t('texts.format')}
          value={draft.value.format}
          placeholder={t('texts.formatPlaceholder')}
          onChange={(v) => draft.set('format', v)}
        />
        <TextArea
          label={t('texts.rules')}
          value={draft.value.rules}
          placeholder={t('texts.rulesPlaceholder')}
          onChange={(v) => draft.set('rules', v)}
        />
        <TextArea
          label={t('texts.about')}
          value={draft.value.about_club}
          placeholder={t('texts.aboutPlaceholder')}
          onChange={(v) => draft.set('about_club', v)}
        />
        <p className="tour__hint">{t('texts.hint')}</p>
      </Card>

      {/* Jedan gumb za sve kartice iznad. Ljepljiv je jer je obrazac dulji od
          ekrana — inače bi se za spremanje naziva moralo skrolati do dna. */}
      <div className="tour__savewrap">
        <SaveBar draft={draft} labels={labels} />
      </div>
    </>
  );
}
