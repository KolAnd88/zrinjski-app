import { useT } from '../i18n/I18nProvider';
import { Card } from '../components/ui';
import type { StringKey } from '../i18n/strings';

/** Privremeni ekran za dijelove admina koje gradimo u sljedećim koracima Faze 3. */
export function Placeholder({ titleKey }: { titleKey: StringKey }) {
  const { t } = useT();
  return (
    <Card style={{ maxWidth: 560 }}>
      <h2 className="section-label" style={{ marginBottom: 'var(--sp-sm)' }}>
        {t(titleKey)} · {t('common.soon')}
      </h2>
      <p style={{ color: 'var(--sub)', margin: 0 }}>{t('common.soonNote')}</p>
    </Card>
  );
}
