import { Link } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import { ClubCrest } from '../components/ClubCrest';
import './Landing.css';

/**
 * Razdvojnica na goloj adresi.
 *
 * Prije je sve išlo na jedan `/login` koji se zvao "Prijava organizatora" i
 * pisao "pristup samo za organizaciju", a na dnu iste stranice zvao klubove da
 * prijave ekipu. Sada svaka publika ima svoju adresu koja se može poslati
 * zasebno: klubovima /klub, organizaciji /admin.
 */
export function Landing() {
  const { t } = useT();

  return (
    <div className="landing">
      <div className="landing__brand">
        <ClubCrest className="landing__logo" />
        <div>
          <div className="landing__name">{t('appName')}</div>
          <div className="landing__sub">{t('landing.subtitle')}</div>
        </div>
      </div>

      <div className="landing__cards">
        <Link to="/klub" className="landing__card landing__card--primary">
          <span className="landing__cardTitle">{t('landing.clubTitle')}</span>
          <span className="landing__cardText">{t('landing.clubText')}</span>
          <span className="landing__cardGo">{t('landing.enter')} →</span>
        </Link>

        <Link to="/admin" className="landing__card">
          <span className="landing__cardTitle">{t('landing.staffTitle')}</span>
          <span className="landing__cardText">{t('landing.staffText')}</span>
          <span className="landing__cardGo">{t('landing.enter')} →</span>
        </Link>
      </div>

      <p className="landing__note">{t('landing.note')}</p>
    </div>
  );
}
