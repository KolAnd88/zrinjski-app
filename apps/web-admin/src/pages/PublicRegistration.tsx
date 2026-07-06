import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Gender } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { submitRegistration } from '../lib/data';
import { Button } from '../components/ui';
import './Login.css';
import './PublicRegistration.css';

export function PublicRegistration() {
  const { t } = useT();
  const [teamName, setTeamName] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  const [playerCount, setPlayerCount] = useState('');
  const [honey, setHoney] = useState(''); // honeypot — ljudi ga ne vide, botovi popune
  const openedAt = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Anti-spam: skriveno polje popunjeno ili forma poslana < 3 s od otvaranja → tiho odbaci.
    if (honey.trim() || Date.now() - openedAt.current < 3000) {
      setDone(true);
      return;
    }

    if (!teamName.trim() || !repName.trim() || !repEmail.trim()) {
      setError(t('regform.errRequired'));
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(repEmail.trim())) {
      setError(t('regform.errEmail'));
      return;
    }

    setBusy(true);
    try {
      const n = Number(playerCount);
      await submitRegistration({
        team_name: teamName.trim(),
        gender,
        rep_name: repName.trim(),
        rep_email: repEmail.trim(),
        player_count: Number.isFinite(n) && n > 0 ? Math.round(n) : null,
      });
      setDone(true);
    } catch {
      setError(t('regform.errSend'));
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setTeamName('');
    setRepName('');
    setRepEmail('');
    setPlayerCount('');
    setDone(false);
    openedAt.current = Date.now();
  }

  return (
    <div className="login regform">
      <div className="login__box">
        <div className="login__brand">
          <div className="login__logo">ZRI</div>
          <div className="login__title">{t('regform.title')}</div>
          <div className="login__subtitle">{t('regform.sub')}</div>
        </div>

        {done ? (
          <div className="regform__success">
            <div className="regform__success-title">{t('regform.successTitle')}</div>
            <p className="regform__success-body">{t('regform.successBody')}</p>
            <Button variant="secondary" block onClick={resetForm}>
              {t('regform.another')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="regform__form">
            {error && <div className="banner banner--error">{error}</div>}

            <div>
              <label className="field-label" htmlFor="rf-team">
                {t('regform.teamName')}
              </label>
              <input
                id="rf-team"
                className="input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="npr. Veterani Mostar"
              />
            </div>

            <div>
              <span className="field-label">{t('regform.gender')}</span>
              <div className="regform__gender" role="group">
                <button
                  type="button"
                  className={`regform__gbtn ${gender === 'm' ? 'is-on' : ''}`}
                  onClick={() => setGender('m')}
                >
                  {t('regform.men')}
                </button>
                <button
                  type="button"
                  className={`regform__gbtn ${gender === 'z' ? 'is-on' : ''}`}
                  onClick={() => setGender('z')}
                >
                  {t('regform.women')}
                </button>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="rf-rep">
                {t('regform.repName')}
              </label>
              <input id="rf-rep" className="input" value={repName} onChange={(e) => setRepName(e.target.value)} />
            </div>

            <div>
              <label className="field-label" htmlFor="rf-email">
                {t('regform.repEmail')}
              </label>
              <input
                id="rf-email"
                className="input"
                type="email"
                value={repEmail}
                onChange={(e) => setRepEmail(e.target.value)}
                placeholder="predstavnik@klub.ba"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="rf-count">
                {t('regform.playerCount')}
              </label>
              <input
                id="rf-count"
                className="input regform__count"
                type="number"
                min={1}
                max={30}
                value={playerCount}
                onChange={(e) => setPlayerCount(e.target.value)}
              />
            </div>

            {/* honeypot — skriveno od ljudi */}
            <input
              className="regform__hp"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
              placeholder="Ostavi prazno"
            />

            <Button type="submit" variant="primary" size="lg" block disabled={busy}>
              {busy ? t('regform.sending') : t('regform.submit')}
            </Button>

            <div className="login__note">{t('regform.note')}</div>
          </form>
        )}

        <div className="regform__adminlink">
          <Link to="/login" className="btn-link">
            {t('regform.adminLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
