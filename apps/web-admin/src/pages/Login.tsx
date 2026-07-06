import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useT } from '../i18n/I18nProvider';
import { DEMO } from '../lib/supabase';
import { Button } from '../components/ui';
import './Login.css';

export function Login() {
  const { t } = useT();
  const { configured, signInWithPassword, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState(DEMO ? 'demo@zrinjski.ba' : '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError(t('login.errEmail'));
      return;
    }
    setBusy(true);
    const { error } = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (error) setError(error === 'not_configured' ? t('login.notConfigured') : t('login.errCreds'));
    // uspjeh → AuthProvider osvježi sesiju, ruter preusmjeri na /
  }

  async function handleMagicLink() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError(t('login.errEmail'));
      return;
    }
    setBusy(true);
    const { error } = await signInWithMagicLink(email.trim());
    setBusy(false);
    if (error) setError(error === 'not_configured' ? t('login.notConfigured') : error);
    else setInfo(t('login.magicSent'));
  }

  return (
    <div className="login">
      <form className="login__box" onSubmit={handleSubmit}>
        <div className="login__brand">
          <div className="login__logo">ZRI</div>
          <div className="login__title">{t('appName')}</div>
          <div className="login__subtitle">{t('login.title')}</div>
        </div>

        {!configured && <div className="banner banner--info">{t('login.notConfigured')}</div>}
        {DEMO && <div className="banner banner--info">DEMO — klikni „Prijava" za ulazak (bez prave baze).</div>}
        {error && <div className="banner banner--error">{error}</div>}
        {info && <div className="banner banner--ok">{info}</div>}

        <div>
          <label className="field-label" htmlFor="email">
            {t('login.email')}
          </label>
          <input
            id="email"
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="delegat@zrinjski.ba"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            {t('login.password')}
          </label>
          <div className="input-wrap">
            <input
              id="password"
              className="input"
              type={showPw ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="input-affix btn-link"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? t('login.hide') : t('login.show')}
            </button>
          </div>
        </div>

        <Button type="submit" variant="primary" size="lg" block disabled={busy}>
          {busy ? t('login.signingIn') : t('login.submit')}
        </Button>

        <div className="login__magic">
          <button type="button" className="btn-link" onClick={() => void handleMagicLink()} disabled={busy}>
            {t('login.magic')}
          </button>
        </div>

        <div className="login__note">{t('login.note')}</div>

        <div style={{ textAlign: 'center', marginTop: 'var(--sp-md)' }}>
          <Link to="/prijava" className="btn-link">
            {t('login.registerLink')}
          </Link>
        </div>
      </form>
    </div>
  );
}
