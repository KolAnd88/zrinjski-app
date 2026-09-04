import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Gender, RegistrationPlayer, Tournament } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import {
  fetchActiveTournament,
  RegistrationSubmissionError,
  submitRegistration,
} from '../lib/data';
import { Button } from '../components/ui';
import { ClubCrest } from '../components/ClubCrest';
import './Login.css';
import './PublicRegistration.css';

export function PublicRegistration() {
  const { t, locale } = useT();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [repName, setRepName] = useState('');
  const [repEmail, setRepEmail] = useState('');
  // Sastav: predstavnik može upisati odmah (ili preskočiti i poslati kasnije).
  const [players, setPlayers] = useState<RegistrationPlayer[]>([
    { name: '', number: null },
    { name: '', number: null },
    { name: '', number: null },
  ]);
  const [honey, setHoney] = useState(''); // honeypot — ljudi ga ne vide, botovi popune
  const openedAt = useRef(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchActiveTournament()
      .then((value) => {
        if (!active) return;
        setTournament(value);
        setStatusError(!value);
      })
      .catch(() => {
        if (active) setStatusError(true);
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      const roster = players
        .filter((p) => p.name.trim())
        .map((p) => ({ name: p.name.trim(), number: p.number }));
      await submitRegistration({
        team_name: teamName.trim(),
        gender,
        rep_name: repName.trim(),
        rep_email: repEmail.trim(),
        player_count: roster.length || null,
        players: roster,
      });
      setDone(true);
    } catch (submissionError) {
      if (submissionError instanceof RegistrationSubmissionError) {
        const errorKey = {
          closed: 'regform.errClosed',
          duplicate: 'regform.errDuplicate',
          rate_limited: 'regform.errRateLimited',
          invalid: 'regform.errInvalid',
          unavailable: 'regform.errSend',
        } as const;
        setError(t(errorKey[submissionError.code]));
        if (submissionError.code === 'closed') {
          setTournament((current) => (current ? { ...current, registration_open: false } : current));
        }
      } else {
        setError(t('regform.errSend'));
      }
    } finally {
      setBusy(false);
    }
  }

  function setPlayer(i: number, patch: Partial<RegistrationPlayer>) {
    setPlayers((xs) => xs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function resetForm() {
    setTeamName('');
    setRepName('');
    setRepEmail('');
    setPlayers([
      { name: '', number: null },
      { name: '', number: null },
      { name: '', number: null },
    ]);
    setDone(false);
    openedAt.current = Date.now();
  }

  const filledPlayers = players.filter((p) => p.name.trim()).length;
  const deadlineExpired =
    !!tournament?.registration_deadline && Date.now() > new Date(tournament.registration_deadline).getTime();
  const registrationOpen = !!tournament?.registration_open && !deadlineExpired;
  const formattedDeadline = tournament?.registration_deadline
    ? new Intl.DateTimeFormat(locale === 'hr' ? 'hr-HR' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(tournament.registration_deadline))
    : null;

  return (
    <div className="login regform">
      <div className="login__box">
        <div className="login__brand">
          <ClubCrest className="login__logo" />
          <div className="login__title">{t('regform.title')}</div>
          {/* Naziv turnira dolazi IZ BAZE, ne iz prijevoda. Ovdje je stajalo
              zakucano "VHMRK Zrinjski Cup", a turnir se zove "Ponos
              Hercegovine 2026" — klub bi na pozivnici vidio jedno ime, a u
              aplikaciji drugo. Prijevod ostaje samo dok se turnir učitava. */}
          <div className="login__subtitle">{tournament?.name ?? t('regform.sub')}</div>
        </div>

        {statusLoading ? (
          <div className="regform__state">
            <div className="regform__state-title">{t('regform.loading')}</div>
          </div>
        ) : statusError ? (
          <div className="regform__state">
            <div className="regform__state-title">{t('regform.unavailableTitle')}</div>
            <p>{t('regform.unavailableBody')}</p>
          </div>
        ) : !registrationOpen ? (
          <div className="regform__state regform__state--closed">
            <div className="regform__state-title">{t('regform.closedTitle')}</div>
            <p>{t('regform.closedBody')}</p>
          </div>
        ) : done ? (
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
            {formattedDeadline && (
              <div className="regform__deadline">{t('regform.deadline', { date: formattedDeadline })}</div>
            )}

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

            {/* Sastav — može se preskočiti i poslati kasnije */}
            <div>
              <div className="regform__rosterhead">
                <span className="field-label" style={{ marginBottom: 0 }}>
                  {t('regform.roster')}
                </span>
                <span className="regform__count-badge">
                  {filledPlayers} {t('regform.rosterCount')}
                </span>
              </div>
              <p className="regform__rosterhint">{t('regform.rosterHint')}</p>

              <div className="regform__players">
                {players.map((p, i) => (
                  <div key={i} className="regform__prow">
                    <input
                      className="input regform__pnum"
                      inputMode="numeric"
                      placeholder={t('regform.playerNumber')}
                      value={p.number ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        const n = Number(v);
                        setPlayer(i, {
                          number: v && Number.isFinite(n) ? Math.max(0, Math.min(999, Math.round(n))) : null,
                        });
                      }}
                    />
                    <input
                      className="input"
                      placeholder={`${t('regform.playerName')} ${i + 1}`}
                      value={p.name}
                      onChange={(e) => setPlayer(i, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className="regform__pdel"
                      aria-label="×"
                      disabled={players.length <= 1}
                      onClick={() => setPlayers((xs) => xs.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="regform__addplayer"
                disabled={players.length >= 40}
                onClick={() => setPlayers((xs) => [...xs, { name: '', number: null }])}
              >
                {players.length >= 40 ? t('regform.maxPlayers') : t('regform.addPlayer')}
              </button>
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
          <Link to="/admin" className="btn-link">
            {t('regform.adminLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
