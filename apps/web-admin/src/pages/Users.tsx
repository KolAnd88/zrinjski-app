import { useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { StringKey } from '../i18n/strings';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card } from '../components/ui';
import { useUsers } from '../features/users/useUsers';
import './Users.css';

const ROLES: { value: string; key: StringKey }[] = [
  { value: 'admin', key: 'users.role.admin' },
  { value: 'delegate', key: 'users.role.delegate' },
  { value: 'rep', key: 'users.role.rep' },
];

export function Users() {
  const { t } = useT();
  const { session } = useAuth();
  const meId = session?.user?.id ?? null;
  const data = useUsers();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('delegate');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const roleLabel = (r: string) => t(ROLES.find((x) => x.value === r)?.key ?? 'users.role.delegate');

  async function handleCreate() {
    if (!email.trim() || password.length < 6) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await data.create({ email: email.trim(), password, role });
      setEmail('');
      setPassword('');
      setMsg(t('users.created'));
      setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (data.loading) return <Card style={{ maxWidth: 560 }}>{t('common.loading')}</Card>;

  return (
    <div className="users">
      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('users.add')}
        </h2>
        <div className="users__form">
          <div className="users__field">
            <label className="field-label">{t('users.email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="osoba@klub.ba" />
          </div>
          <div className="users__field">
            <label className="field-label">{t('users.password')}</label>
            <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="users__field">
            <label className="field-label">{t('users.role')}</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {t(r.key)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          variant="primary"
          style={{ marginTop: 'var(--sp-md)' }}
          disabled={busy || !email.trim() || password.length < 6}
          onClick={() => void handleCreate()}
        >
          {busy ? t('users.creating') : t('users.create')}
        </Button>
        {msg && <div className="banner banner--ok" style={{ marginTop: 'var(--sp-md)' }}>{msg}</div>}
        {err && <div className="banner banner--error" style={{ marginTop: 'var(--sp-md)' }}>{err}</div>}
        {data.demo && <p className="users__note">{t('users.demoNote')}</p>}
        <p className="users__note">{t('users.hint')}</p>
      </Card>

      <Card>
        <h2 className="section-label" style={{ marginBottom: 'var(--sp-md)' }}>
          {t('users.title')}
        </h2>
        {data.error && <div className="banner banner--error" style={{ marginBottom: 'var(--sp-md)' }}>{data.error}</div>}
        {data.users.length === 0 ? (
          <div style={{ color: 'var(--sub)' }}>{t('users.empty')}</div>
        ) : (
          <div className="user-list">
            {data.users.map((u) => (
              <div key={u.id} className="user-row">
                <div className="user-row__main">
                  <div className="user-row__email">
                    {u.email}
                    {u.id === meId && <span className="user-row__you"> · {t('users.you')}</span>}
                  </div>
                </div>
                <select
                  className="input user-row__role"
                  value={u.role}
                  onChange={(e) => void data.setRole(u.id, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {roleLabel(r.value)}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-link user-row__del"
                  disabled={u.id === meId}
                  onClick={() => {
                    if (confirm(t('users.removeConfirm'))) void data.remove(u.id);
                  }}
                >
                  {t('users.remove')}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
