import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { I18nProvider, useT } from './i18n/I18nProvider';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { PublicRegistration } from './pages/PublicRegistration';
import { RepPortal } from './pages/RepPortal';
import { Dashboard } from './pages/Dashboard';
import { Tournament } from './pages/Tournament';
import { Schedule } from './pages/Schedule';
import { Teams } from './pages/Teams';
import { Live } from './pages/Live';
import { Tv } from './pages/Tv';
import { Sponsors } from './pages/Sponsors';
import { Registrations } from './pages/Registrations';
import { Notices } from './pages/Notices';
import { Promo } from './pages/Promo';
import { Gallery } from './pages/Gallery';
import { Users } from './pages/Users';

function FullScreenMessage({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--sub)' }}>
      {text}
    </div>
  );
}

function AppRoutes() {
  const { session, loading, configured, role, isStaff } = useAuth();
  const { t } = useT();

  // Dok Supabase nije konfiguriran, dopusti pristup loginu (koji prikazuje uputu).
  if (loading) return <FullScreenMessage text={t('common.loading')} />;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Javna prijava ekipe — dostupna bez prijave */}
        <Route path="/prijava" element={<PublicRegistration />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Predstavnik ekipe (rep) vidi samo svoj portal — ne admin sučelje.
  // (Baza to i tehnički jamči kroz RLS; ovo je da UI ne nudi ono što ionako ne smije.)
  if (role === 'rep' || (session && !isStaff && role !== null)) {
    return (
      <Routes>
        <Route path="/prijava" element={<PublicRegistration />} />
        <Route path="/moja-ekipa" element={<RepPortal />} />
        <Route path="*" element={<Navigate to="/moja-ekipa" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* TV / semafor — preko cijelog ekrana, bez sidebar layouta */}
      <Route path="/tv" element={<Tv />} />
      {/* Javna prijava ekipe (radi i dok je admin prijavljen — za dijeljenje linka) */}
      <Route path="/prijava" element={<PublicRegistration />} />

      <Route element={<Layout title="dash.title" />}>
        <Route index element={<Dashboard />} />
      </Route>
      <Route element={<Layout title="nav.live" />}>
        <Route path="/live" element={<Live />} />
      </Route>
      <Route element={<Layout title="nav.schedule" />}>
        <Route path="/schedule" element={<Schedule />} />
      </Route>
      <Route element={<Layout title="nav.teams" />}>
        <Route path="/teams" element={<Teams />} />
      </Route>
      <Route element={<Layout title="nav.tournament" />}>
        <Route path="/tournament" element={<Tournament />} />
      </Route>
      <Route element={<Layout title="nav.sponsors" />}>
        <Route path="/sponsors" element={<Sponsors />} />
      </Route>
      <Route element={<Layout title="nav.notices" />}>
        <Route path="/notices" element={<Notices />} />
      </Route>
      <Route element={<Layout title="nav.promo" />}>
        <Route path="/promo" element={<Promo />} />
      </Route>
      <Route element={<Layout title="nav.gallery" />}>
        <Route path="/gallery" element={<Gallery />} />
      </Route>
      <Route element={<Layout title="nav.registrations" />}>
        <Route path="/registrations" element={<Registrations />} />
      </Route>
      <Route element={<Layout title="nav.users" />}>
        <Route path="/users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
