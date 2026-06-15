import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { I18nProvider, useT } from './i18n/I18nProvider';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Tournament } from './pages/Tournament';
import { Schedule } from './pages/Schedule';
import { Teams } from './pages/Teams';
import { Placeholder } from './pages/Placeholder';

function FullScreenMessage({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--sub)' }}>
      {text}
    </div>
  );
}

function AppRoutes() {
  const { session, loading, configured } = useAuth();
  const { t } = useT();

  // Dok Supabase nije konfiguriran, dopusti pristup loginu (koji prikazuje uputu).
  if (loading) return <FullScreenMessage text={t('common.loading')} />;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout title="dash.title" />}>
        <Route index element={<Dashboard />} />
      </Route>
      <Route element={<Layout title="nav.live" />}>
        <Route path="/live" element={<Placeholder titleKey="nav.live" />} />
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
        <Route path="/sponsors" element={<Placeholder titleKey="nav.sponsors" />} />
      </Route>
      <Route element={<Layout title="nav.notices" />}>
        <Route path="/notices" element={<Placeholder titleKey="nav.notices" />} />
      </Route>
      <Route element={<Layout title="nav.promo" />}>
        <Route path="/promo" element={<Placeholder titleKey="nav.promo" />} />
      </Route>
      <Route element={<Layout title="nav.registrations" />}>
        <Route path="/registrations" element={<Placeholder titleKey="nav.registrations" />} />
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
