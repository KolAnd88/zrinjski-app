import { useEffect, useState } from 'react';
import type { AppUser, Team } from '@zrinjski/core';
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

function UserRow({
  user,
  teams,
  isMe,
  onSave,
  onRemove,
}: {
  user: AppUser;
  teams: Team[];
  isMe: boolean;
  onSave: (role: string, teamId: string | null) => Promise<void>;
  onRemove: () => void;
}) {
  const { t } = useT();
  const [role, setRole] = useState(user.role);
  const [teamId, setTeamId] = useState(user.team_id ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRole(user.role);
    setTeamId(user.team_id ?? '');
  }, [user.role, user.team_id]);

  const normalizedTeamId = role === 'rep' ? teamId || null : null;
  const dirty = role !== user.role || normalizedTeamId !== user.team_id;
  const valid = role !== 'rep' || !!teamId;

  async function save() {
    if (!dirty || !valid || isMe) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave(role, normalizedTeamId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="user-row">
      <div className="user-row__main">
        <div className="user-row__email">
          {user.email}
          {isMe && <span className="user-row__you"> · {t('users.you')}</span>}
        </div>
        {err && <div className="user-row__error">{err}</div>}
      </div>
      <div className="user-row__access">
        <select
          className="input user-row__role"
          value={role}
          disabled={busy || isMe}
          onChange={(e) => setRole(e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {t(r.key)}
            </option>
          ))}
        </select>
        {role === 'rep' && (
          <select
            className="input user-row__team"
            value={teamId}
            disabled={busy || isMe}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">{t('users.repTeamPick')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        className="btn-link user-row__save"
        disabled={!dirty || !valid || busy || isMe}
        onClick={() => void save()}
      >
        {busy ? t('users.saving') : t('users.save')}
      </button>
      <button className="btn-link user-row__del" disabled={isMe || busy} onClick={onRemove}>
        {t('users.remove')}
      </button>
    </div>
  );
}

export function Users() {
  const { t } = useT();
  const { session } = useAuth();
  const meId = session?.user?.id ?? null;
  const data = useUsers();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('delegate');
  const [repTeamId, setRepTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Predstavnik mora biti vezan uz ekipu — inače nema što uređivati.
  const needsTeam = role === 'rep';

  async function handleCreate() {
    if (!email.trim() || password.length < 6) return;
    if (needsTeam && !repTeamId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await data.create({
        email: email.trim(),
        password,
        role,
        team_id: needsTeam ? repTeamId : null,
      });
      setEmail('');
      setPassword('');
      setRepTeamId('');
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

        {/* Predstavnik ekipe uređuje samo sastav te ekipe. */}
        {needsTeam && (
          <div className="users__field" style={{ marginTop: 'var(--sp-md)', maxWidth: 320 }}>
            <label className="field-label">{t('users.repTeam')}</label>
            <select className="input" value={repTeamId} onChange={(e) => setRepTeamId(e.target.value)}>
              <option value="">{t('users.repTeamPick')}</option>
              {data.teams.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.name} ({tm.gender === 'm' ? t('common.menu') : t('common.women')})
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          variant="primary"
          style={{ marginTop: 'var(--sp-md)' }}
          disabled={busy || !email.trim() || password.length < 6 || (needsTeam && !repTeamId)}
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
            <UserRow
              key={u.id}
              user={u}
              teams={data.teams}
              isMe={u.id === meId}
              onSave={(nextRole, nextTeamId) => data.setAccess(u.id, nextRole, nextTeamId)}
              onRemove={() => {
                if (confirm(t('users.removeConfirm'))) void data.remove(u.id);
              }}
            />
          ))}
          </div>
        )}
      </Card>
    </div>
  );
}
