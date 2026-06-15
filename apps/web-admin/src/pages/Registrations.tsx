import type { Registration } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { Card, Crest } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useRegistrations } from '../features/registrations/useRegistrations';
import { autoShortCode, colorForName } from '../lib/crest';
import './Registrations.css';

function PendingCard({
  reg,
  onApprove,
  onReject,
}: {
  reg: Registration;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useT();
  return (
    <Card className="regcard">
      <div className="regcard__head">
        <Crest code={autoShortCode(reg.team_name)} color={colorForName(reg.team_name)} size={56} />
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
      <div className="regcard__actions">
        <button className="btn-approve" onClick={onApprove}>
          {t('reg.approve')}
        </button>
        <button className="btn-reject" onClick={onReject}>
          {t('reg.reject')}
        </button>
      </div>
    </Card>
  );
}

export function Registrations() {
  const { t } = useT();
  const tournament = useTournamentData();
  const data = useRegistrations(tournament.tournament?.id ?? null);

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (data.error) return <Card accent style={{ maxWidth: 560 }}>{data.error}</Card>;

  return (
    <div className="regs">
      <div className="regs__head">
        <h2 className="section-label">{t('reg.pendingTitle')}</h2>
        {data.pending.length > 0 && <span className="regs__count">{data.pending.length}</span>}
      </div>

      {data.pending.length === 0 ? (
        <div className="regs__empty">{t('reg.noPending')}</div>
      ) : (
        <div className="regs__pending">
          {data.pending.map((r) => (
            <PendingCard
              key={r.id}
              reg={r}
              onApprove={() => void data.approve(r)}
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
          {data.approved.map((r) => (
            <div key={r.id} className="approved-row">
              <Crest code={autoShortCode(r.team_name)} color={colorForName(r.team_name)} size={40} />
              <span className="approved-row__name">{r.team_name}</span>
              <span className="approved-row__check">✓</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
