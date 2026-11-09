import { useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { Button, Card } from '../../components/ui';
import { refreshAllShareAssets, type ShareAssetsResult } from './shareAssets';

/**
 * Pregled trake sponzora sa slike rezultata i gumb koji iznova složi traku i
 * umanjene grbove. Traka se slaže i sama pri svakoj promjeni sponzora; gumb je
 * za prvi put i za grbove ekipa unesene prije ove mogućnosti.
 */
export function ShareAssetsCard({
  tournamentId,
  stripUrl,
  onDone,
}: {
  tournamentId: string;
  stripUrl: string | null;
  onDone: () => void;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ShareAssetsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      setResult(await refreshAllShareAssets(tournamentId));
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="share-assets">
      <h2 className="section-label">{t('share.title')}</h2>
      <p className="share-assets__hint">{t('share.hint')}</p>
      {stripUrl ? (
        <img className="share-assets__strip" src={stripUrl} alt={t('share.stripAlt')} />
      ) : (
        <div className="share-assets__none">{t('share.noStrip')}</div>
      )}
      <Button variant="secondary" disabled={busy} onClick={() => void run()}>
        {busy ? t('share.working') : t('share.rebuild')}
      </Button>
      {result && (
        <p className="share-assets__ok">
          {t('share.done', { n: result.crests })}
          {result.failed.length > 0 && ` ${t('share.failed', { list: result.failed.join(', ') })}`}
        </p>
      )}
      {err && <p className="share-assets__err">{err}</p>}
    </Card>
  );
}
