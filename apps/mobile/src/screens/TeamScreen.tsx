import { useT } from '../i18n/I18nProvider';
import { PlaceholderScreen } from './Placeholder';

export function TeamScreen() {
  const { t } = useT();
  return <PlaceholderScreen title={t('team.squad')} />;
}
