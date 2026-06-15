import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import './Layout.css';

const NAV: { to: string; key: StringKey }[] = [
  { to: '/', key: 'nav.dashboard' },
  { to: '/live', key: 'nav.live' },
  { to: '/schedule', key: 'nav.schedule' },
  { to: '/teams', key: 'nav.teams' },
  { to: '/tournament', key: 'nav.tournament' },
  { to: '/sponsors', key: 'nav.sponsors' },
  { to: '/notices', key: 'nav.notices' },
  { to: '/promo', key: 'nav.promo' },
  { to: '/registrations', key: 'nav.registrations' },
];

function LangToggle() {
  const { locale, setLocale } = useT();
  return (
    <div className="lang-toggle" role="group" aria-label="Jezik">
      <button
        className={locale === 'hr' ? 'is-active' : ''}
        onClick={() => setLocale('hr')}
      >
        HR
      </button>
      <button
        className={locale === 'en' ? 'is-active' : ''}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
    </div>
  );
}

export function Layout({ title }: { title: StringKey }) {
  const { t } = useT();
  const { signOut } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">ZRI</div>
          <div>
            <div className="sidebar__name">{t('appName')}</div>
            <div className="sidebar__sub">{t('webAdmin')}</div>
          </div>
        </div>

        <nav className="sidebar__nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `navlink ${isActive ? 'is-active' : ''}`}
            >
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="navlink" style={{ width: '100%' }} onClick={() => void signOut()}>
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <h1 className="topbar__title">{t(title)}</h1>
          <LangToggle />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
