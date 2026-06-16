import { useT } from '../i18n/I18nProvider';
import { PlaceholderScreen } from './Placeholder';

export function LiveScreen() {
  const { t } = useT();
  return <PlaceholderScreen title={t('live.title')} />;
}
