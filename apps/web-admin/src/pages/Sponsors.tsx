import { useState } from 'react';
import type { Sponsor, SponsorTier } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { Button, Card } from '../components/ui';
import { useTournamentData } from '../features/tournament/useTournamentData';
import { useSponsors } from '../features/sponsors/useSponsors';
import { SponsorModal } from '../features/sponsors/SponsorModal';
import './Sponsors.css';

const TIER_LABEL: Record<SponsorTier, StringKey> = {
  gold: 'sponsors.tier.gold',
  silver: 'sponsors.tier.silver',
  bronze: 'sponsors.tier.bronze',
  partner: 'sponsors.tier.partner',
};

function Logo({ url }: { url: string | null }) {
  const { t } = useT();
  return (
    <div className="slogo">
      {url ? <img src={url} alt="" /> : <span>{t('sponsors.logoPlaceholder')}</span>}
    </div>
  );
}

type Editing = { sponsor: Sponsor | null; fixedTier?: SponsorTier } | null;

export function Sponsors() {
  const { t } = useT();
  const tournament = useTournamentData();
  const data = useSponsors(tournament.tournament?.id ?? null);
  const [editing, setEditing] = useState<Editing>(null);

  if (!data.configured) return <Card style={{ maxWidth: 560 }}>{t('common.notConfigured')}</Card>;
  if (tournament.loading || data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;
  if (data.error) return <Card accent style={{ maxWidth: 560 }}>{data.error}</Card>;

  return (
    <div className="sponsors">
      {/* Zlatni sponzor */}
      <div className="sponsors__goldhead">
        <h2 className="section-label sponsors__goldlabel">{t('sponsors.goldTitle')}</h2>
        {data.gold && (
          <label className="switch">
            <input
              type="checkbox"
              checked={data.gold.is_active}
              onChange={(e) => void data.setActive(data.gold!.id, e.target.checked)}
            />
            <span className="switch__track" />
          </label>
        )}
      </div>

      {data.gold ? (
        <div className="gold-card">
          <Logo url={data.gold.logo_url} />
          <div className="gold-card__main">
            <div className="gold-card__name">{data.gold.name}</div>
            <div className="gold-card__hint">{t('sponsors.goldHint')}</div>
          </div>
          <button className="gold-card__edit" onClick={() => setEditing({ sponsor: data.gold })}>
            {t('tournament.edit')}
          </button>
        </div>
      ) : (
        <button
          className="sponsors__add sponsors__add--gold"
          onClick={() => setEditing({ sponsor: null, fixedTier: 'gold' })}
        >
          {t('sponsors.addGold')}
        </button>
      )}

      {/* Ostali sponzori */}
      <h2 className="section-label" style={{ marginTop: 'var(--sp-md)' }}>
        {t('sponsors.othersTitle')}
      </h2>
      {data.others.length === 0 ? (
        <div className="sponsors__empty">{t('sponsors.noOthers')}</div>
      ) : (
        <div className="sponsor-list">
          {data.others.map((s) => (
            <div key={s.id} className="sponsor-row">
              <Logo url={s.logo_url} />
              <div className="sponsor-row__main">
                <div className="sponsor-row__name">{s.name}</div>
                <span className={`tier-badge tier-badge--${s.tier}`}>{t(TIER_LABEL[s.tier])}</span>
              </div>
              <button className="btn-link" onClick={() => setEditing({ sponsor: s })}>
                {t('sponsors.edit')}
              </button>
              <button
                className="sponsor-row__del"
                aria-label="×"
                onClick={() => {
                  if (confirm(t('sponsors.deleteConfirm'))) void data.removeSponsor(s.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <Button variant="primary" size="lg" block onClick={() => setEditing({ sponsor: null })}>
        {t('sponsors.add')}
      </Button>

      {editing && (
        <SponsorModal
          sponsor={editing.sponsor}
          fixedTier={editing.fixedTier}
          onClose={() => setEditing(null)}
          onSave={data.saveSponsor}
        />
      )}
    </div>
  );
}
