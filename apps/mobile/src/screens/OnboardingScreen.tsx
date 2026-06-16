import { useT } from '../i18n/I18nProvider';
import { PlaceholderScreen } from './Placeholder';

export function OnboardingScreen() {
  const { t } = useT();
  return <PlaceholderScreen title={t('onb.langTitle')} />;
}
