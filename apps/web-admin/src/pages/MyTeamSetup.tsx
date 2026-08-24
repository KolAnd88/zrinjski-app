import { useState } from 'react';
import type { Gender } from '@zrinjski/core';
import { useT } from '../i18n/I18nProvider';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui';
import { RegistrationSubmissionError, submitMyRegistration } from '../lib/data';
import './RepPortal.css';

/**
 * Prvi ekran predstavnika bez ekipe: prijava vlastite ekipe na turnir.
 * Nastaje red u `registration` vezan uz njegov račun; ekipa se pojavljuje u
 * turniru tek kad je organizator odobri.
 */
export function MyTeamSetup({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { signOut } = useAuth();

  const [teamName, setTeamName] = useState('');
  const [gender, setGender] = useState<Gender>('m');
  const [repName, setRepName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!teamName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await submitMyRegistration({ team_name: teamName.trim(), gender, rep_name: repName.trim() });
      onDone();
    } catch (e) {
      if (e instanceof RegistrationSubmissionError) {
        const msg = {
          closed: 'regform.errClosed',
          duplicate: 'regform.errDuplicate',
          rate_limited: 'regform.errRateLimited',
          invalid: 'regform.errInvalid',
          unavailable: 'regform.errSend',
        } as const;
        setErr(t(msg[e.code]));
      } else {
        setErr(e instanceof Error ? e.message : String(e));
      }
      setBusy(false);
    }
  }

  return (
    <div className="rep">
      <div className="rep__head">
        <div style={{ flex: 1 }}>
          <div className="rep__role">{t('rep.subtitle')}</div>
          <h1 className="rep__team">{t('setup.title')}</h1>
        </div>
        <button className="btn-link" onClick={() => void signOut()}>
          {t('nav.logout')}
        </button>
      </div>

      <div className="card">
        <p className="rep__hint" style={{ marginTop: 0 }}>
          {t('setup.intro')}
        </p>

        {err && <div className="banner banner--error" style={{ marginBottom: 'var(--sp-md)' }}>{err}</div>}

        <label className="field-label">{t('setup.teamName')}</label>
        <input
          className="input"
          value={teamName}
          autoFocus
          onChange={(e) => setTeamName(e.target.value)}
          placeholder={t('setup.teamNamePh')}
        />

        <label className="field-label" style={{ marginTop: 'var(--sp-md)' }}>
          {t('setup.gender')}
        </label>
        <select className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
          <option value="m">{t('regform.men')}</option>
          <option value="z">{t('regform.women')}</option>
        </select>

        <label className="field-label" style={{ marginTop: 'var(--sp-md)' }}>
          {t('setup.repName')}
        </label>
        <input
          className="input"
          value={repName}
          onChange={(e) => setRepName(e.target.value)}
          placeholder={t('setup.repNamePh')}
        />

        <Button
          variant="primary"
          block
          size="lg"
          disabled={busy || !teamName.trim()}
          style={{ marginTop: 'var(--sp-lg)' }}
          onClick={() => void submit()}
        >
          {busy ? t('setup.sending') : t('setup.submit')}
        </Button>

        <p className="rep__hint">{t('setup.afterNote')}</p>
      </div>
    </div>
  );
}
