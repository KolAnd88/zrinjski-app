import { useEffect, useState } from 'react';
import type { Registration } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Button, Card, Crest } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useRegistrations } from '../features/registrations/useRegistrations';
import { autoShortCode, crestColorFor } from '../lib/crest';
import './Registrations.css';

function PendingCard({
  reg,
  index,
  onApprove,
  onReject,
  busy,
}: {
  reg: Registration;
  index: number;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const { t } = useT();
  return (
    <Card className="regcard">
      <div className="regcard__head">
        {/* Prijava još nije ekipa → boja po indeksu u popisu. */}
        <Crest code={autoShortCode(reg.team_name)} color={crestColorFor(index)} size={56} />
        <div>
          <div className="regcard__name">{reg.team_name}</div>
          <div className="regcard__meta">
            <span className="gender-badge">{reg.gender === 'm' ? t('common.menu') : t('common.women')}</span>
            {reg.player_count != null && (
              <span>
                {reg.player_count} {t('reg.players')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="regcard__rep">
        {t('reg.rep')}: {reg.rep_name}
        <br />
        <span className="regcard__email">{reg.rep_email}</span>
      </div>

      {/* Prijavljeni sastav — kreira se kao igrači kad se prijava odobri. */}
      {(reg.players?.length ?? 0) > 0 && (
        <div className="regcard__roster">
          <div className="regcard__roster-head">
            {t('reg.roster')} · {reg.players.length}
          </div>
          <div className="regcard__roster-list">
            {reg.players.map((p, i) => (
              <span key={i} className="regcard__player">
                {p.number != null && <b>{p.number}</b>} {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="regcard__actions">
        <button className="btn-approve" onClick={onApprove} disabled={busy}>
          {busy ? t('reg.processing') : t('reg.approve')}
        </button>
        <button className="btn-reject" onClick={onReject} disabled={busy}>
          {t('reg.reject')}
        </button>
      </div>
    </Card>
  );
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function Registrations() {
  const { t } = useT();
  const tournament = useTournamentData();
  const data = useRegistrations(tournament.tournament?.id ?? null);
  const [deadline, setDeadline] = useState('');
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    setDeadline(toLocalDateTimeInput(tournament.tournament?.registration_deadline ?? null));
  }, [tournament.tournament?.registration_deadline]);

  async function saveRegistrationSettings(patch: {
    registration_open?: boolean;
    registration_deadline?: string | null;
  }) {
    setSettingsBusy(true);
    setSettingsMessage(null);
    try {
      await tournament.saveSettings(patch);
      setSettingsMessage(t('reg.settingsSaved'));
    } catch {
      setSettingsMessage(t('reg.settingsError'));
    } finally {
      setSettingsBusy(false);
    }
  }

  function saveDeadline() {
    if (!deadline) {
      void saveRegistrationSettings({ registration_deadline: null });
      return;
    }
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) {
      setSettingsMessage(t('reg.settingsInvalidDeadline'));
      return;
    }
    void saveRegistrationSettings({ registration_deadline: parsed.toISOString() });
  }

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (tournament.error) return <Card accent style={{ maxWidth: 560 }}>{tournament.error}</Card>;
  if (!tournament.tournament) return <Card accent style={{ maxWidth: 560 }}>{t('reg.noTournament')}</Card>;

  const isOpen = tournament.tournament.registration_open;
  const deadlineExpired =
    !!tournament.tournament.registration_deadline &&
    Date.now() > new Date(tournament.tournament.registration_deadline).getTime();

  return (
    <div className="regs">
      <Card className="regs-settings">
        <div className="regs-settings__head">
          <div>
            <h2 className="section-label">{t('reg.settingsTitle')}</h2>
            <p className="regs-settings__hint">{t('reg.settingsHint')}</p>
          </div>
          <span className={`regs-settings__status ${isOpen && !deadlineExpired ? 'is-open' : 'is-closed'}`}>
            {isOpen && !deadlineExpired ? t('reg.settingsOpen') : t('reg.settingsClosed')}
          </span>
        </div>

        <div className="regs-settings__controls">
          <Button
            type="button"
            variant={isOpen ? 'secondary' : 'primary'}
            disabled={settingsBusy}
            onClick={() => void saveRegistrationSettings({ registration_open: !isOpen })}
          >
            {isOpen ? t('reg.settingsClose') : t('reg.settingsOpenAction')}
          </Button>
          <label className="regs-settings__deadline">
            <span className="field-label">{t('reg.settingsDeadline')}</span>
            <input
              className="input"
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              disabled={settingsBusy}
            />
          </label>
          <Button type="button" variant="secondary" disabled={settingsBusy} onClick={saveDeadline}>
            {t('reg.settingsSaveDeadline')}
          </Button>
          {deadline && (
            <Button
              type="button"
              variant="ghost"
              disabled={settingsBusy}
              onClick={() => {
                setDeadline('');
                void saveRegistrationSettings({ registration_deadline: null });
              }}
            >
              {t('reg.settingsClearDeadline')}
            </Button>
          )}
        </div>
        {deadlineExpired && isOpen && <div className="banner">{t('reg.settingsDeadlineExpired')}</div>}
        {settingsMessage && <div className="regs-settings__message">{settingsMessage}</div>}
      </Card>

      {data.error && <div className="banner banner--error">{data.error}</div>}

      <div className="regs__head">
        <h2 className="section-label">{t('reg.pendingTitle')}</h2>
        {data.pending.length > 0 && <span className="regs__count">{data.pending.length}</span>}
      </div>

      {data.pending.length === 0 ? (
        <div className="regs__empty">{t('reg.noPending')}</div>
      ) : (
        <div className="regs__pending">
          {data.pending.map((r, i) => (
            <PendingCard
              key={r.id}
              reg={r}
              index={i}
              onApprove={() => void data.approve(r)}
              busy={data.processingId === r.id}
              onReject={() => {
                if (confirm(t('reg.rejectConfirm'))) void data.reject(r.id);
              }}
            />
          ))}
        </div>
      )}

      <h2 className="section-label" style={{ marginTop: 'var(--sp-lg)' }}>
        {t('reg.approvedTitle')}
      </h2>
      {data.approved.length === 0 ? (
        <div className="regs__empty">{t('reg.noApproved')}</div>
      ) : (
        <div className="regs__approved">
          {data.approved.map((r, i) => (
            <div key={r.id} className="approved-row">
              <Crest code={autoShortCode(r.team_name)} color={crestColorFor(i)} size={40} />
              <span className="approved-row__name">{r.team_name}</span>
              <span className="approved-row__check">✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
