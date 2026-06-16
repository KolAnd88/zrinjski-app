import { useT } from '../i18n/I18nProvider';
import { PlaceholderScreen } from './Placeholder';

export function HomeScreen() {
  const { t } = useT();
  return <PlaceholderScreen title={t('nav.home')} />;
}
