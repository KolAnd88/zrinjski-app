import { useT } from '../i18n/I18nProvider';
import { PlaceholderScreen } from './Placeholder';

export function SearchScreen() {
  const { t } = useT();
  return <PlaceholderScreen title={t('common.search')} />;
}
