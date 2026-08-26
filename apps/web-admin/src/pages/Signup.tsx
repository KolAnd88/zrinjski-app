import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useT } from '../i18n/I18nProvider';
import { Button } from '../components/ui';
import './Login.css';

/**
 * Otvaranje računa predstavnika kluba.
 * Račun sam po sebi ne može ništa — dobiva ulogu 'rep' bez ekipe (okidač u
 * bazi). Ekipa se prijavljuje tek iznutra i čeka odobrenje organizatora.
 */
export function Signup() {
  const { t } = useT();
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    const { error, needsConfirm } = await signUp(email.trim(), password);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    if (needsConfirm) {
      setConfirmSent(true);
      return;
    }
    navigate('/moja-ekipa');
  }

  if (confirmSent) {
    return (
      <div className="login">
        <div className="login__card">
          <div className="login__brand">
            <span className="crest login__crest">ZRI</span>
            <span className="login__brandname">{t('appName')}</span>
          </div>
          <h1 className="login__title">{t('signup.checkMailTitle')}</h1>
          <p className="login__note">{t('signup.checkMailBody', { e: email.trim() })}</p>
          <Link className="login__link" to="/klub">
            {t('signup.toLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <span className="crest login__crest">ZRI</span>
          <span className="login__brandname">{t('appName')}</span>
        </div>

        <h1 className="login__title">{t('signup.title')}</h1>
        <p className="login__note">{t('signup.intro')}</p>

        {err && <div className="banner banner--error" style={{ marginBottom: 'var(--sp-md)' }}>{err}</div>}

        <label className="field-label">{t('login.email')}</label>
        <input
          className="input"
          type="email"
          value={email}
          autoFocus
          onChange={(e) => setEmail(e.target.value)}
          placeholder="klub@primjer.ba"
        />

        <label className="field-label" style={{ marginTop: 'var(--sp-md)' }}>
          {t('users.password')}
        </label>
        <div className="login__pwrow">
          <input
            className="input"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
          <button className="btn-link" onClick={() => setShow((v) => !v)}>
            {show ? t('login.hide') : t('login.show')}
          </button>
        </div>

        <Button
          variant="primary"
          block
          size="lg"
          disabled={busy || !canSubmit}
          style={{ marginTop: 'var(--sp-lg)' }}
          onClick={() => void submit()}
        >
          {busy ? t('signup.creating') : t('signup.submit')}
        </Button>

        <Link className="login__link" to="/klub">
          {t('signup.haveAccount')}
        </Link>
      </div>
    </div>
  );
}
