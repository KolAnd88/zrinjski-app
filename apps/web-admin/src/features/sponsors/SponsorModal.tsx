import { useState } from 'react';
import type { Sponsor, SponsorTier } from '@zrinjski/core';
import { useT } from '../../i18n/I18nProvider';
import type { StringKey } from '../../i18n/strings';
import { Button } from '../../components/ui';
import { SponsorLogoError, validateSponsorLogo } from '../../lib/data';
import { ImageEditor } from '../../components/ImageEditor';
import type { SponsorInput } from './useSponsors';
import './SponsorModal.css';

const TIERS: { tier: SponsorTier; key: StringKey }[] = [
  { tier: 'gold', key: 'sponsors.tier.gold' },
  { tier: 'silver', key: 'sponsors.tier.silver' },
  { tier: 'bronze', key: 'sponsors.tier.bronze' },
  { tier: 'partner', key: 'sponsors.tier.partner' },
];

export function SponsorModal({
  sponsor,
  fixedTier,
  onClose,
  onSave,
}: {
  sponsor: Sponsor | null;
  fixedTier?: SponsorTier;
  onClose: () => void;
  onSave: (input: SponsorInput) => Promise<void>;
}) {
  const { t } = useT();
  const [name, setName] = useState(sponsor?.name ?? '');
  const [tier, setTier] = useState<SponsorTier>(sponsor?.tier ?? fixedTier ?? 'silver');
  const [isActive, setIsActive] = useState(sponsor?.is_active ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(sponsor?.logo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<File | null>(null);

  // Provjera ide odmah pri odabiru, ne tek na Spremi — organizator vidi
  // problem prije nego ispuni ostatak obrasca.
  async function onPickFile(f: File | null) {
    setErr(null);
    if (!f) {
      setFile(null);
      return;
    }
    try {
      await validateSponsorLogo(f);
      // SVG se ne dira; rastersku sliku pokaži u uređivaču da dobije rub.
      if (f.type === 'image/svg+xml') {
        setFile(f);
        setPreview(URL.createObjectURL(f));
      } else {
        setEditing(f);
      }
    } catch (e) {
      setFile(null);
      if (e instanceof SponsorLogoError) {
        const msg = {
          type: 'sponsors.errType',
          size: 'sponsors.errSize',
          tooSmall: 'sponsors.errTooSmall',
          tooLarge: 'sponsors.errTooLarge',
          ratio: 'sponsors.errRatio',
        } as const;
        setErr(t(msg[e.reason]));
      } else {
        setErr(e instanceof Error ? e.message : String(e));
      }
    }
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        id: sponsor?.id,
        name: name.trim(),
        tier,
        is_active: isActive,
        logo_url: sponsor?.logo_url ?? null,
        file,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2 className="modal__title">{sponsor ? t('sponsors.editTitle') : t('sponsors.newTitle')}</h2>
          <button className="modal__close" aria-label="×" onClick={onClose}>
            ×
          </button>
        </div>

        {err && <div className="banner banner--error" style={{ marginBottom: 'var(--sp-md)' }}>{err}</div>}

        <div className="smodal__logo">
          <div className="smodal__logo-box">
            {preview ? <img src={preview} alt="" /> : <span>{t('sponsors.logoPlaceholder')}</span>}
          </div>
          <label className="btn btn--secondary smodal__upload">
            {sponsor?.logo_url || file ? t('sponsors.changeLogo') : t('sponsors.uploadLogo')}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <p className="smodal__hint">{t('sponsors.logoHint')}</p>

        {editing && (
          <ImageEditor
            file={editing}
            mode="fit"
            // 900 je širina izlaza; visina slijedi omjer okvira (vidi
            // imageFrame.ts). Djeljivo s pregledom od 300 px, pa nema
            // zaokruživanja koje bi sredinu pomaknulo za djelić piksela.
            size={900}
            onCancel={() => setEditing(null)}
            onDone={(out) => {
              setEditing(null);
              setFile(out);
              setPreview(URL.createObjectURL(out));
            }}
          />
        )}

        <div style={{ marginTop: 'var(--sp-md)' }}>
          <label className="field-label">{t('sponsors.name')}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div style={{ marginTop: 'var(--sp-md)' }}>
          <label className="field-label">{t('sponsors.tier')}</label>
          <select
            className="input"
            value={tier}
            disabled={!!fixedTier}
            onChange={(e) => setTier(e.target.value as SponsorTier)}
          >
            {TIERS.map((x) => (
              <option key={x.tier} value={x.tier}>
                {t(x.key)}
              </option>
            ))}
          </select>
        </div>

        <label className="smodal__active">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          {t('sponsors.active')}
        </label>

        <Button
          variant="primary"
          block
          disabled={busy || !name.trim()}
          onClick={() => void save()}
          style={{ marginTop: 'var(--sp-lg)' } as React.CSSProperties}
        >
          {busy ? t('sponsors.uploading') : t('tournament.save')}
        </Button>
      </div>
    </div>
  );
}
