import { useT } from '../i18n/I18nProvider';
import { PlaceholderScreen } from './Placeholder';

export function NotifSettingsScreen() {
  const { t } = useT();
  return <PlaceholderScreen title={t('notif.title')} />;
}
